import {
  env,
  InterruptableStoppingCriteria,
  type PretrainedModelOptions,
  pipeline,
  StoppingCriteriaList,
  TextStreamer,
} from "@huggingface/transformers";

import { getModelConfig } from "@/lib/chat-config";
import type {
  ChatDevice,
  ChatGenerationOverrides,
  ChatModelId,
  ModelLoadProgress,
  ModelMessage,
  StreamChannel,
  WorkerEvent,
  WorkerRequest,
} from "@/lib/chat-types";
import { createReasoningSplitter, promptOpensReasoning } from "@/lib/reasoning";

type Generator = Awaited<ReturnType<typeof pipeline<"text-generation">>>;

type ProgressPayload = {
  file?: string;
  loaded?: number;
  name?: string;
  progress?: number;
  status?: string;
  total?: number;
};

type WebGpuNavigator = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown>;
  };
};

env.allowLocalModels = false;
env.useBrowserCache = true;

const STREAM_FLUSH_INTERVAL_MS = 40;
const STREAM_FLUSH_THRESHOLD_CHARS = 48;

let generator: Generator | null = null;
let loadedModelId: ChatModelId | null = null;
let loadPromise: Promise<Generator> | null = null;
let loadingModelId: ChatModelId | null = null;
let activeRequestId: string | null = null;
let activeDevice: ChatDevice = "wasm";
let bufferedText = "";
let bufferedChannel: StreamChannel = "content";
let bufferedModelId: ChatModelId | null = null;
let bufferedRequestId: string | null = null;
let flushTimeoutId: number | null = null;
// Generations run one at a time: a new request waits until the previous run
// (including its cleanup) finishes, so two runs never share mutable state.
let generationQueue: Promise<void> = Promise.resolve();
const interruptable = new InterruptableStoppingCriteria();

function postMessage(event: WorkerEvent) {
  self.postMessage(event);
}

function clearFlushTimeout() {
  if (flushTimeoutId !== null) {
    clearTimeout(flushTimeoutId);
    flushTimeoutId = null;
  }
}

function flushBufferedText() {
  clearFlushTimeout();

  if (
    !bufferedText ||
    !bufferedModelId ||
    !bufferedRequestId ||
    activeRequestId !== bufferedRequestId
  ) {
    bufferedText = "";
    bufferedModelId = null;
    bufferedRequestId = null;
    return;
  }

  postMessage({
    type: "token",
    channel: bufferedChannel,
    modelId: bufferedModelId,
    requestId: bufferedRequestId,
    text: bufferedText,
  });

  bufferedText = "";
  bufferedModelId = null;
  bufferedRequestId = null;
}

function bufferChunk(
  modelId: ChatModelId,
  requestId: string,
  channel: StreamChannel,
  text: string,
) {
  if (!text || activeRequestId !== requestId) {
    return;
  }

  // Each token event carries one channel, so flush on a reasoning/answer switch.
  if (bufferedText && bufferedChannel !== channel) {
    flushBufferedText();
  }

  bufferedChannel = channel;
  bufferedText += text;
  bufferedModelId = modelId;
  bufferedRequestId = requestId;

  if (bufferedText.length >= STREAM_FLUSH_THRESHOLD_CHARS) {
    flushBufferedText();
    return;
  }

  if (flushTimeoutId === null) {
    flushTimeoutId = self.setTimeout(() => {
      flushBufferedText();
    }, STREAM_FLUSH_INTERVAL_MS);
  }
}

async function getDeviceCandidates(): Promise<ChatDevice[]> {
  const webGpuNavigator =
    typeof navigator !== "undefined" ? (navigator as WebGpuNavigator) : null;

  if (webGpuNavigator?.gpu) {
    try {
      const adapter = await webGpuNavigator.gpu.requestAdapter();
      if (adapter) {
        return ["webgpu", "wasm"];
      }
    } catch {
      // Ignore and fall through to WASM.
    }
  }

  return ["wasm"];
}

function normalizeProgress(
  payload: ProgressPayload,
  detail: string,
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
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Model execution failed.";
}

async function loadGenerator(modelId: ChatModelId): Promise<Generator> {
  if (generator && loadedModelId === modelId) {
    return generator;
  }

  if (loadPromise && loadingModelId === modelId) {
    return loadPromise;
  }

  const model = getModelConfig(modelId);
  performance.mark(`worker-model-load-start:${modelId}`);

  loadingModelId = modelId;
  loadPromise = (async () => {
    const candidates = await getDeviceCandidates();
    let lastError: unknown = null;

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
        });

        const options: PretrainedModelOptions = {
          device: candidate,
          dtype: model.dtype,
          progress_callback: (payload: ProgressPayload) => {
            if (payload.status === "ready") {
              return;
            }

            postMessage({
              type: "progress",
              modelId,
              progress: normalizeProgress(
                payload,
                candidate === "webgpu"
                  ? `Loading ${model.label} for WebGPU.`
                  : `Loading ${model.label} for mobile-safe CPU inference.`,
              ),
            });
          },
        };

        const loaded = await pipeline(
          "text-generation",
          model.modelId,
          options,
        );
        performance.measure(
          `worker-model-load:${modelId}`,
          `worker-model-load-start:${modelId}`,
        );

        generator = loaded;
        loadedModelId = modelId;
        activeDevice = candidate;

        postMessage({
          type: "ready",
          modelId,
          device: activeDevice,
          dtype: model.dtype,
        });

        return loaded;
      } catch (error) {
        lastError = error;

        if (candidate === "webgpu") {
          postMessage({
            type: "progress",
            modelId,
            progress: {
              phase: "Fallback",
              progress: null,
              detail: "WebGPU failed. Falling back to CPU/WASM.",
            },
          });
        }
      }
    }

    throw lastError ?? new Error("Unable to initialize the chat model.");
  })().finally(() => {
    loadPromise = null;
    loadingModelId = null;
  });

  return loadPromise;
}

/**
 * Some reasoning templates (LFM2.5 2.6B / Thinking) end the prompt inside an
 * open think block, so the stream starts mid-reasoning with no opening tag.
 */
function templateOpensReasoning(
  activeGenerator: Generator,
  messages: ModelMessage[],
): boolean {
  try {
    const prompt = activeGenerator.tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      tokenize: false,
    });
    return typeof prompt === "string" && promptOpensReasoning(prompt);
  } catch {
    return false;
  }
}

function mergeGenerationOptions(
  base: ReturnType<typeof getModelConfig>["generation"],
  overrides?: ChatGenerationOverrides,
) {
  return {
    ...base,
    ...overrides,
  };
}

async function runGeneration(
  requestId: string,
  modelId: ChatModelId,
  messages: ModelMessage[],
  generationOverrides?: ChatGenerationOverrides,
) {
  activeRequestId = requestId;
  bufferedText = "";
  bufferedModelId = modelId;
  bufferedRequestId = requestId;

  try {
    const activeGenerator = await loadGenerator(modelId);
    const model = getModelConfig(modelId);
    const generationOptions = mergeGenerationOptions(
      model.generation,
      generationOverrides,
    );
    interruptable.reset();
    performance.mark(`worker-generation-start:${requestId}`);

    const stoppingCriteria = new StoppingCriteriaList();
    stoppingCriteria.push(interruptable);
    let generatedTokenCount = 0;

    const reasoningSplitter = createReasoningSplitter({
      startInReasoning: templateOpensReasoning(activeGenerator, messages),
    });
    const emitSegments = (
      segments: ReturnType<typeof reasoningSplitter.push>,
    ) => {
      for (const segment of segments) {
        bufferChunk(modelId, requestId, segment.channel, segment.text);
      }
    };

    const streamer = new TextStreamer(activeGenerator.tokenizer, {
      callback_function: (text) => {
        emitSegments(reasoningSplitter.push(text));
      },
      skip_prompt: true,
      token_callback_function: (tokens) => {
        generatedTokenCount += tokens.length;
      },
    });

    await activeGenerator(messages, {
      ...generationOptions,
      stopping_criteria: stoppingCriteria,
      streamer,
    } as Parameters<Generator>[1] & {
      stopping_criteria: StoppingCriteriaList;
    });

    emitSegments(reasoningSplitter.flush());
    flushBufferedText();
    performance.measure(
      `worker-generation:${requestId}`,
      `worker-generation-start:${requestId}`,
    );

    postMessage({
      type: "complete",
      generatedTokens: generatedTokenCount,
      modelId,
      requestId,
      finishReason: interruptable.interrupted
        ? "stopped"
        : generatedTokenCount >= generationOptions.max_new_tokens
          ? "length"
          : "completed",
    });
  } catch (error) {
    flushBufferedText();
    postMessage({
      type: "error",
      modelId,
      error: getErrorMessage(error),
      requestId,
    });
  } finally {
    clearFlushTimeout();
    bufferedText = "";
    bufferedModelId = null;
    bufferedRequestId = null;
    if (activeRequestId === requestId) {
      activeRequestId = null;
    }
    interruptable.reset();
  }
}

self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  postMessage({
    type: "error",
    error: getErrorMessage(event.reason),
  });
  event.preventDefault();
});

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data;

  switch (payload.type) {
    case "init": {
      void loadGenerator(payload.modelId).catch((error) => {
        postMessage({
          type: "error",
          modelId: payload.modelId,
          error: getErrorMessage(error),
        });
      });
      return;
    }

    case "generate": {
      // runGeneration reports its own failures, so the queue never rejects.
      generationQueue = generationQueue.then(() =>
        runGeneration(
          payload.requestId,
          payload.modelId,
          payload.messages,
          payload.generationOverrides,
        ),
      );
      return;
    }

    case "stop": {
      interruptable.interrupt();
      flushBufferedText();
      return;
    }

    case "reset": {
      // Abandon the running generation: stop it at the next token and drop
      // anything it still emits. The next queued run resets the criteria.
      interruptable.interrupt();
      activeRequestId = null;
      clearFlushTimeout();
      bufferedText = "";
      bufferedModelId = null;
      bufferedRequestId = null;
    }
  }
});
