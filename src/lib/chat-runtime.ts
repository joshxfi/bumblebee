import type { WorkerEvent, WorkerRequest, ModelMessage } from "@/lib/chat-types"

type ChatRuntimeListener = (event: WorkerEvent) => void

export type ChatRuntime = {
  subscribe: (listener: ChatRuntimeListener) => () => void
  init: () => void
  generate: (requestId: string, messages: ModelMessage[]) => void
  stop: () => void
  reset: () => void
  dispose: () => void
}

type WorkerLike = Pick<
  Worker,
  "addEventListener" | "removeEventListener" | "postMessage" | "terminate"
>

export class ChatRuntimeClient implements ChatRuntime {
  private readonly listeners = new Set<ChatRuntimeListener>()
  private readonly worker: WorkerLike

  constructor(createWorker: () => WorkerLike = createDefaultWorker) {
    this.worker = createWorker()
    this.worker.addEventListener("message", this.handleMessage as EventListener)
    this.worker.addEventListener("error", this.handleError as EventListener)
  }

  subscribe(listener: ChatRuntimeListener) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  init() {
    this.worker.postMessage({ type: "init" } satisfies WorkerRequest)
  }

  generate(requestId: string, messages: ModelMessage[]) {
    this.worker.postMessage({
      type: "generate",
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

  dispose() {
    this.worker.removeEventListener(
      "message",
      this.handleMessage as EventListener
    )
    this.worker.removeEventListener("error", this.handleError as EventListener)
    this.worker.terminate()
    this.listeners.clear()
  }

  private readonly handleMessage = (event: MessageEvent<WorkerEvent>) => {
    this.emit(event.data)
  }

  private readonly handleError = (event: ErrorEvent) => {
    this.emit({
      type: "error",
      error: event.message || "The inference worker crashed.",
    })
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
