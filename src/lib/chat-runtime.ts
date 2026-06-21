import type {
  ChatGenerationOverrides,
  ChatModelId,
  ChatPerfSample,
  ModelMessage,
  WorkerEvent,
  WorkerRequest,
} from "@/lib/chat-types";

type ChatRuntimeListener = (event: WorkerEvent) => void;
type ChatPerfListener = (sample: ChatPerfSample | null) => void;

type LoadPerfState = {
  modelId: ChatModelId;
  startedAt: number;
};

type RequestPerfState = {
  compactionDroppedChars?: number;
  compactionSummarizeMs?: number;
  firstTokenAt: number | null;
  historyTurnCount: number;
  messageChars: number;
  modelId: ChatModelId;
  requestId: string;
  startedAt: number;
};

const perfListeners = new Set<ChatPerfListener>();
let latestPerfSample: ChatPerfSample | null = null;

const IS_DEV = Boolean(import.meta.env.DEV);

export type ChatRuntimeGenerateOptions = {
  compactionDroppedChars?: number;
  compactionSummarizeMs?: number;
  generationOverrides?: ChatGenerationOverrides;
};

export type ChatRuntime = {
  subscribe: (listener: ChatRuntimeListener) => () => void;
  init: (modelId: ChatModelId) => void;
  generate: (
    requestId: string,
    modelId: ChatModelId,
    messages: ModelMessage[],
    options?: ChatRuntimeGenerateOptions,
  ) => void;
  stop: () => void;
  reset: () => void;
  recreateWorker: () => void;
  dispose: () => void;
};

type WorkerLike = Pick<
  Worker,
  "addEventListener" | "removeEventListener" | "postMessage" | "terminate"
>;

export class ChatRuntimeClient implements ChatRuntime {
  private readonly listeners = new Set<ChatRuntimeListener>();
  private readonly createWorker: () => WorkerLike;
  private currentModelId: ChatModelId | null = null;
  private loadPerf: LoadPerfState | null = null;
  private readyModelId: ChatModelId | null = null;
  private requestPerf: RequestPerfState | null = null;
  private worker: WorkerLike;

  constructor(createWorker: () => WorkerLike = createDefaultWorker) {
    this.createWorker = createWorker;
    this.worker = createWorker();
    this.bindWorker(this.worker);
  }

  subscribe(listener: ChatRuntimeListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  init(modelId: ChatModelId) {
    this.currentModelId = modelId;
    if (this.readyModelId !== modelId) {
      this.beginLoadPerf(modelId);
    }
    this.worker.postMessage({ type: "init", modelId } satisfies WorkerRequest);
  }

  generate(
    requestId: string,
    modelId: ChatModelId,
    messages: ModelMessage[],
    options?: ChatRuntimeGenerateOptions,
  ) {
    this.currentModelId = modelId;
    if (this.readyModelId !== modelId && this.loadPerf?.modelId !== modelId) {
      this.beginLoadPerf(modelId);
    }
    this.requestPerf = {
      compactionDroppedChars: options?.compactionDroppedChars,
      compactionSummarizeMs: options?.compactionSummarizeMs,
      firstTokenAt: null,
      historyTurnCount: messages.reduce(
        (count, message) => count + (message.role === "user" ? 1 : 0),
        0,
      ),
      messageChars: messages.reduce(
        (count, message) => count + message.content.length,
        0,
      ),
      modelId,
      requestId,
      startedAt: performance.now(),
    };
    performance.mark(`generation-start:${requestId}`);
    this.worker.postMessage({
      type: "generate",
      generationOverrides: options?.generationOverrides,
      modelId,
      requestId,
      messages,
    } satisfies WorkerRequest);
  }

  stop() {
    this.worker.postMessage({ type: "stop" } satisfies WorkerRequest);
  }

  reset() {
    this.worker.postMessage({ type: "reset" } satisfies WorkerRequest);
    // Settle any in-flight awaiters (e.g. context compaction) that are waiting
    // on a worker reply for a request the reset just cancelled.
    this.emit({ type: "aborted" });
  }

  recreateWorker() {
    this.currentModelId = null;
    this.loadPerf = null;
    this.readyModelId = null;
    this.requestPerf = null;
    this.unbindWorker(this.worker);
    this.worker.terminate();
    this.worker = this.createWorker();
    this.bindWorker(this.worker);
    // The previous worker can no longer reply; release in-flight awaiters.
    this.emit({ type: "aborted" });
  }

  dispose() {
    this.loadPerf = null;
    this.readyModelId = null;
    this.requestPerf = null;
    this.unbindWorker(this.worker);
    this.worker.terminate();
    this.emit({ type: "aborted" });
    this.listeners.clear();
  }

  private readonly handleMessage = (event: MessageEvent<WorkerEvent>) => {
    this.recordPerfFromWorkerEvent(event.data);
    this.emit(event.data);
  };

  private readonly handleError = (event: ErrorEvent) => {
    this.emit({
      type: "error",
      modelId: this.currentModelId ?? undefined,
      error: event.message || "The inference worker crashed.",
    });
  };

  private bindWorker(worker: WorkerLike) {
    worker.addEventListener("message", this.handleMessage as EventListener);
    worker.addEventListener("error", this.handleError as EventListener);
  }

  private unbindWorker(worker: WorkerLike) {
    worker.removeEventListener("message", this.handleMessage as EventListener);
    worker.removeEventListener("error", this.handleError as EventListener);
  }

  private emit(event: WorkerEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private beginLoadPerf(modelId: ChatModelId) {
    this.loadPerf = {
      modelId,
      startedAt: performance.now(),
    };
    performance.mark(`model-load-start:${modelId}`);
  }

  private recordPerfFromWorkerEvent(event: WorkerEvent) {
    switch (event.type) {
      case "ready": {
        this.readyModelId = event.modelId;

        if (this.loadPerf?.modelId !== event.modelId) {
          return;
        }

        const modelLoadMs = performance.now() - this.loadPerf.startedAt;
        performance.measure(
          `model-load:${event.modelId}`,
          `model-load-start:${event.modelId}`,
        );
        this.loadPerf = null;

        emitPerfSample({
          device: event.device,
          kind: "load",
          modelLoadMs,
          selectedModelId: event.modelId,
          timestamp: Date.now(),
        });
        return;
      }

      case "token": {
        if (
          !this.requestPerf ||
          this.requestPerf.requestId !== event.requestId ||
          this.requestPerf.modelId !== event.modelId ||
          this.requestPerf.firstTokenAt !== null
        ) {
          return;
        }

        this.requestPerf.firstTokenAt = performance.now();
        performance.measure(
          `first-token:${event.requestId}`,
          `generation-start:${event.requestId}`,
        );
        return;
      }

      case "complete": {
        if (
          !this.requestPerf ||
          this.requestPerf.requestId !== event.requestId ||
          this.requestPerf.modelId !== event.modelId
        ) {
          return;
        }

        const completionMs = performance.now() - this.requestPerf.startedAt;
        const firstTokenMs =
          this.requestPerf.firstTokenAt === null
            ? undefined
            : this.requestPerf.firstTokenAt - this.requestPerf.startedAt;

        performance.measure(
          `generation-complete:${event.requestId}`,
          `generation-start:${event.requestId}`,
        );

        emitPerfSample({
          compactionDroppedChars: this.requestPerf.compactionDroppedChars,
          compactionSummarizeMs: this.requestPerf.compactionSummarizeMs,
          completionMs,
          firstTokenMs,
          generatedTokens: event.generatedTokens,
          historyTurnCount: this.requestPerf.historyTurnCount,
          kind: "generation",
          messageChars: this.requestPerf.messageChars,
          selectedModelId: event.modelId,
          timestamp: Date.now(),
          tokensPerSec:
            completionMs > 0
              ? event.generatedTokens / (completionMs / 1000)
              : undefined,
        });

        this.requestPerf = null;
        return;
      }

      case "error": {
        if (
          this.requestPerf &&
          event.requestId &&
          this.requestPerf.requestId === event.requestId
        ) {
          this.requestPerf = null;
        }
      }
    }
  }
}

function emitPerfSample(sample: ChatPerfSample) {
  latestPerfSample = sample;

  if (IS_DEV) {
    const title =
      sample.kind === "load"
        ? `[perf] ${sample.selectedModelId} load`
        : `[perf] ${sample.selectedModelId} generation`;

    console.groupCollapsed(title);
    console.table(sample);
    console.groupEnd();
  }

  for (const listener of perfListeners) {
    listener(sample);
  }
}

export function subscribeChatPerf(listener: ChatPerfListener) {
  perfListeners.add(listener);

  return () => {
    perfListeners.delete(listener);
  };
}

export function getLatestChatPerfSample() {
  return latestPerfSample;
}

function createDefaultWorker() {
  return new Worker(new URL("../workers/chat.worker.ts", import.meta.url), {
    type: "module",
  });
}

function createNoopRuntime(): ChatRuntime {
  return {
    subscribe: () => () => undefined,
    init: () => undefined,
    generate: () => undefined,
    stop: () => undefined,
    reset: () => undefined,
    recreateWorker: () => undefined,
    dispose: () => undefined,
  };
}

let defaultRuntime: ChatRuntime | null = null;

export function getDefaultChatRuntime() {
  if (typeof Worker === "undefined") {
    return createNoopRuntime();
  }

  if (defaultRuntime) {
    return defaultRuntime;
  }

  defaultRuntime = new ChatRuntimeClient();
  return defaultRuntime;
}
