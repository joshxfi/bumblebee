import type {
  ChatModelId,
  ModelMessage,
  WorkerEvent,
  WorkerRequest,
} from "@/lib/chat-types"

type ChatRuntimeListener = (event: WorkerEvent) => void

export type ChatRuntime = {
  subscribe: (listener: ChatRuntimeListener) => () => void
  init: (modelId: ChatModelId) => void
  generate: (
    requestId: string,
    modelId: ChatModelId,
    messages: ModelMessage[]
  ) => void
  stop: () => void
  reset: () => void
  recreateWorker: () => void
  dispose: () => void
}

type WorkerLike = Pick<
  Worker,
  "addEventListener" | "removeEventListener" | "postMessage" | "terminate"
>

export class ChatRuntimeClient implements ChatRuntime {
  private readonly listeners = new Set<ChatRuntimeListener>()
  private readonly createWorker: () => WorkerLike
  private currentModelId: ChatModelId | null = null
  private worker: WorkerLike

  constructor(createWorker: () => WorkerLike = createDefaultWorker) {
    this.createWorker = createWorker
    this.worker = createWorker()
    this.bindWorker(this.worker)
  }

  subscribe(listener: ChatRuntimeListener) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  init(modelId: ChatModelId) {
    this.currentModelId = modelId
    this.worker.postMessage({ type: "init", modelId } satisfies WorkerRequest)
  }

  generate(requestId: string, modelId: ChatModelId, messages: ModelMessage[]) {
    this.currentModelId = modelId
    this.worker.postMessage({
      type: "generate",
      modelId,
      requestId,
      messages,
    } satisfies WorkerRequest)
  }

  stop() {
    this.worker.postMessage({ type: "stop" } satisfies WorkerRequest)
  }

  reset() {
    this.worker.postMessage({ type: "reset" } satisfies WorkerRequest)
  }

  recreateWorker() {
    this.currentModelId = null
    this.unbindWorker(this.worker)
    this.worker.terminate()
    this.worker = this.createWorker()
    this.bindWorker(this.worker)
  }

  dispose() {
    this.unbindWorker(this.worker)
    this.worker.terminate()
    this.listeners.clear()
  }

  private readonly handleMessage = (event: MessageEvent<WorkerEvent>) => {
    this.emit(event.data)
  }

  private readonly handleError = (event: ErrorEvent) => {
    this.emit({
      type: "error",
      modelId: this.currentModelId ?? undefined,
      error: event.message || "The inference worker crashed.",
    })
  }

  private bindWorker(worker: WorkerLike) {
    worker.addEventListener("message", this.handleMessage as EventListener)
    worker.addEventListener("error", this.handleError as EventListener)
  }

  private unbindWorker(worker: WorkerLike) {
    worker.removeEventListener("message", this.handleMessage as EventListener)
    worker.removeEventListener("error", this.handleError as EventListener)
  }

  private emit(event: WorkerEvent) {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

function createDefaultWorker() {
  return new Worker(new URL("../workers/chat.worker.ts", import.meta.url), {
    type: "module",
  })
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
  }
}

let defaultRuntime: ChatRuntime | null = null

export function getDefaultChatRuntime() {
  if (typeof Worker === "undefined") {
    return createNoopRuntime()
  }

  if (defaultRuntime) {
    return defaultRuntime
  }

  defaultRuntime = new ChatRuntimeClient()
  return defaultRuntime
}
