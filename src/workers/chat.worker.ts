import {
  env,
  InterruptableStoppingCriteria,
  pipeline,
  StoppingCriteriaList,
  TextStreamer,
  type PretrainedModelOptions,
} from "@huggingface/transformers"

import { getModelConfig } from "@/lib/chat-config"
import type {
  ChatDevice,
  ChatModelId,
  ModelLoadProgress,
  ModelMessage,
  WorkerEvent,
  WorkerRequest,
} from "@/lib/chat-types"

type Generator = Awaited<ReturnType<typeof pipeline<"text-generation">>>

type ProgressPayload = {
  file?: string
  loaded?: number
  name?: string
  progress?: number
  status?: string
  total?: number
}

type WebGpuNavigator = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown>
  }
}

env.allowLocalModels = false
env.useBrowserCache = true

const STREAM_FLUSH_INTERVAL_MS = 40
const STREAM_FLUSH_THRESHOLD_CHARS = 48

let generator: Generator | null = null
let loadedModelId: ChatModelId | null = null
let loadPromise: Promise<Generator> | null = null
let loadingModelId: ChatModelId | null = null
let activeRequestId: string | null = null
let activeDevice: ChatDevice = "wasm"
let bufferedText = ""
let bufferedModelId: ChatModelId | null = null
let bufferedRequestId: string | null = null
let flushTimeoutId: number | null = null
const interruptable = new InterruptableStoppingCriteria()

function postMessage(event: WorkerEvent) {
  self.postMessage(event)
}

function clearFlushTimeout() {
  if (flushTimeoutId !== null) {
    clearTimeout(flushTimeoutId)
    flushTimeoutId = null
  }
}

function flushBufferedText() {
  clearFlushTimeout()

  if (
    !bufferedText ||
    !bufferedModelId ||
    !bufferedRequestId ||
    activeRequestId !== bufferedRequestId
  ) {
    bufferedText = ""
    bufferedModelId = null
    bufferedRequestId = null
    return
  }

  postMessage({
    type: "token",
    modelId: bufferedModelId,
    requestId: bufferedRequestId,
    text: bufferedText,
  })

  bufferedText = ""
  bufferedModelId = null
  bufferedRequestId = null
}

function bufferChunk(modelId: ChatModelId, requestId: string, text: string) {
  if (!text || activeRequestId !== requestId) {
    return
  }

  bufferedText += text
  bufferedModelId = modelId
  bufferedRequestId = requestId

  if (bufferedText.length >= STREAM_FLUSH_THRESHOLD_CHARS) {
    flushBufferedText()
    return
  }

  if (flushTimeoutId === null) {
    flushTimeoutId = self.setTimeout(() => {
      flushBufferedText()
    }, STREAM_FLUSH_INTERVAL_MS)
  }
}

async function getDeviceCandidates(): Promise<ChatDevice[]> {
  const webGpuNavigator =
    typeof navigator !== "undefined" ? (navigator as WebGpuNavigator) : null

  if (webGpuNavigator?.gpu) {
    try {
      const adapter = await webGpuNavigator.gpu.requestAdapter()
      if (adapter) {
        return ["webgpu", "wasm"]
      }
    } catch {
      // Ignore and fall through to WASM.
    }
  }

  return ["wasm"]
}

function normalizeProgress(
  payload: ProgressPayload,
  detail: string
): ModelLoadProgress {
  return {
    detail,
    file: payload.file,
    loaded: payload.loaded,
    phase:
      payload.status === "download"
        ? "Downloading"
        : payload.status === "progress"
          ? "Caching"
          : "Preparing",
    progress:
      typeof payload.progress === "number"
        ? Math.max(0, Math.min(100, payload.progress))
        : payload.loaded && payload.total
          ? Math.round((payload.loaded / payload.total) * 100)
          : null,
    total: payload.total,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return "Model execution failed."
}

async function loadGenerator(modelId: ChatModelId): Promise<Generator> {
  if (generator && loadedModelId === modelId) {
    return generator
  }

  if (loadPromise && loadingModelId === modelId) {
    return loadPromise
  }

  const candidates = await getDeviceCandidates()
  const model = getModelConfig(modelId)
  performance.mark(`worker-model-load-start:${modelId}`)

  loadingModelId = modelId
  loadPromise = (async () => {
    let lastError: unknown = null

    for (const candidate of candidates) {
      try {
        postMessage({
          type: "progress",
          modelId,
          progress: {
            phase: "Warm up",
            progress: null,
            detail:
              candidate === "webgpu"
                ? `Trying WebGPU first for ${model.label}.`
                : `Loading ${model.label} with the CPU/WASM runtime.`,
          },
        })

        const options: PretrainedModelOptions = {
          device: candidate,
          dtype: model.dtype,
          progress_callback: (payload: ProgressPayload) => {
            if (payload.status === "ready") {
              return
            }

            postMessage({
              type: "progress",
              modelId,
              progress: normalizeProgress(
                payload,
                candidate === "webgpu"
                  ? `Loading ${model.label} for WebGPU.`
                  : `Loading ${model.label} for mobile-safe CPU inference.`
              ),
            })
          },
        }

        const loaded = await pipeline("text-generation", model.modelId, options)
        performance.measure(
          `worker-model-load:${modelId}`,
          `worker-model-load-start:${modelId}`
        )

        generator = loaded
        loadedModelId = modelId
        activeDevice = candidate

        postMessage({
          type: "ready",
          modelId,
          device: activeDevice,
          dtype: model.dtype,
        })

        return loaded
      } catch (error) {
        lastError = error

        if (candidate === "webgpu") {
          postMessage({
            type: "progress",
            modelId,
            progress: {
              phase: "Fallback",
              progress: null,
              detail: "WebGPU failed. Falling back to CPU/WASM.",
            },
          })
          continue
        }
      }
    }

    throw lastError ?? new Error("Unable to initialize the chat model.")
  })().finally(() => {
    loadPromise = null
    loadingModelId = null
  })

  return loadPromise
}

async function runGeneration(
  requestId: string,
  modelId: ChatModelId,
  messages: ModelMessage[]
) {
  activeRequestId = requestId
  bufferedText = ""
  bufferedModelId = modelId
  bufferedRequestId = requestId

  try {
    const activeGenerator = await loadGenerator(modelId)
    const model = getModelConfig(modelId)
    interruptable.reset()
    performance.mark(`worker-generation-start:${requestId}`)

    const stoppingCriteria = new StoppingCriteriaList()
    stoppingCriteria.push(interruptable)
    let generatedTokenCount = 0

    const streamer = new TextStreamer(activeGenerator.tokenizer, {
      callback_function: (text) => {
        bufferChunk(modelId, requestId, text)
      },
      skip_prompt: true,
      token_callback_function: (tokens) => {
        generatedTokenCount += tokens.length
      },
    })

    await activeGenerator(messages, {
      ...model.generation,
      stopping_criteria: stoppingCriteria,
      streamer,
    } as Parameters<Generator>[1] & {
      stopping_criteria: StoppingCriteriaList
    })

    flushBufferedText()
    performance.measure(
      `worker-generation:${requestId}`,
      `worker-generation-start:${requestId}`
    )

    postMessage({
      type: "complete",
      generatedTokens: generatedTokenCount,
      modelId,
      requestId,
      finishReason: interruptable.interrupted
        ? "stopped"
        : generatedTokenCount >= model.generation.max_new_tokens
          ? "length"
          : "completed",
    })
  } catch (error) {
    flushBufferedText()
    postMessage({
      type: "error",
      modelId,
      error: getErrorMessage(error),
      requestId,
    })
  } finally {
    clearFlushTimeout()
    bufferedText = ""
    bufferedModelId = null
    bufferedRequestId = null
    activeRequestId = null
    interruptable.reset()
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data

  switch (payload.type) {
    case "init": {
      void loadGenerator(payload.modelId).catch((error) => {
        postMessage({
          type: "error",
          modelId: payload.modelId,
          error: getErrorMessage(error),
        })
      })
      return
    }

    case "generate": {
      void runGeneration(payload.requestId, payload.modelId, payload.messages)
      return
    }

    case "stop": {
      interruptable.interrupt()
      flushBufferedText()
      return
    }

    case "reset": {
      activeRequestId = null
      clearFlushTimeout()
      bufferedText = ""
      bufferedModelId = null
      bufferedRequestId = null
      interruptable.reset()
    }
  }
})
