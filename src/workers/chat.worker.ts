import {
  env,
  InterruptableStoppingCriteria,
  pipeline,
  StoppingCriteriaList,
  TextStreamer,
  type PretrainedModelOptions,
} from "@huggingface/transformers"

import { CHAT_MODEL_CONFIG } from "@/lib/chat-config"
import type {
  ChatDevice,
  ModelMessage,
  ModelLoadProgress,
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

env.allowLocalModels = false
env.useBrowserCache = true

let generator: Generator | null = null
let loadPromise: Promise<Generator> | null = null
let activeRequestId: string | null = null
let activeDevice: ChatDevice = "wasm"
const interruptable = new InterruptableStoppingCriteria()

type WebGpuNavigator = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown>
  }
}

function postMessage(event: WorkerEvent) {
  self.postMessage(event)
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

async function loadGenerator(): Promise<Generator> {
  if (generator) {
    return generator
  }

  if (loadPromise) {
    return loadPromise
  }

  const candidates = await getDeviceCandidates()

  loadPromise = (async () => {
    let lastError: unknown = null

    for (const candidate of candidates) {
      const deviceLabel = candidate

      try {
        postMessage({
          type: "progress",
          progress: {
            phase: "Warm up",
            progress: null,
            detail:
              deviceLabel === "webgpu"
                ? "Trying WebGPU first for faster local generation."
                : "Loading the CPU/WASM runtime.",
          },
        })

        const options: PretrainedModelOptions = {
          device: candidate,
          dtype: CHAT_MODEL_CONFIG.dtype,
          progress_callback: (payload: ProgressPayload) => {
            if (payload.status === "ready") {
              return
            }

            postMessage({
              type: "progress",
              progress: normalizeProgress(
                payload,
                deviceLabel === "webgpu"
                  ? "Loading model files for WebGPU."
                  : "Loading model files for mobile-safe CPU inference."
              ),
            })
          },
        }

        const loaded = await pipeline(
          "text-generation",
          CHAT_MODEL_CONFIG.modelId,
          options
        )

        generator = loaded
        activeDevice = candidate

        postMessage({
          type: "ready",
          device: activeDevice,
          dtype: CHAT_MODEL_CONFIG.dtype,
          modelId: CHAT_MODEL_CONFIG.modelId,
        })

        return loaded
      } catch (error) {
        lastError = error

        if (candidate === "webgpu") {
          postMessage({
            type: "progress",
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
  })

  return loadPromise
}

async function runGeneration(requestId: string, messages: ModelMessage[]) {
  activeRequestId = requestId

  try {
    const activeGenerator = await loadGenerator()
    interruptable.reset()

    const stoppingCriteria = new StoppingCriteriaList()
    stoppingCriteria.push(interruptable)

    const streamer = new TextStreamer(activeGenerator.tokenizer, {
      callback_function: (text) => {
        if (!text || activeRequestId !== requestId) {
          return
        }

        postMessage({ type: "token", requestId, text })
      },
      skip_prompt: true,
    })

    await activeGenerator(messages, {
      ...CHAT_MODEL_CONFIG.generation,
      stopping_criteria: stoppingCriteria,
      streamer,
    } as Parameters<Generator>[1] & {
      stopping_criteria: StoppingCriteriaList
    })

    postMessage({
      type: "complete",
      requestId,
      finishReason: interruptable.interrupted ? "stopped" : "completed",
    })
  } catch (error) {
    postMessage({
      type: "error",
      error: getErrorMessage(error),
      requestId,
    })
  } finally {
    activeRequestId = null
    interruptable.reset()
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data

  switch (payload.type) {
    case "init": {
      void loadGenerator().catch((error) => {
        postMessage({
          type: "error",
          error: getErrorMessage(error),
        })
      })
      return
    }

    case "generate": {
      void runGeneration(payload.requestId, payload.messages)
      return
    }

    case "stop": {
      interruptable.interrupt()
      return
    }

    case "reset": {
      activeRequestId = null
      interruptable.reset()
    }
  }
})
