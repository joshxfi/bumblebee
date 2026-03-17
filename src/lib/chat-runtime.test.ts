import { describe, expect, it, vi } from "vitest"

import { ChatRuntimeClient } from "@/lib/chat-runtime"
import type { WorkerEvent, WorkerRequest } from "@/lib/chat-types"

class WorkerDouble extends EventTarget {
  messages: WorkerRequest[] = []

  postMessage(payload: WorkerRequest) {
    this.messages.push(payload)
  }

  terminate() {}

  emitWorkerEvent(payload: WorkerEvent) {
    this.dispatchEvent(new MessageEvent("message", { data: payload }))
  }
}

describe("chat runtime", () => {
  it("posts worker commands and relays worker events to subscribers", () => {
    const worker = new WorkerDouble()
    const runtime = new ChatRuntimeClient(() => worker as unknown as Worker)
    const listener = vi.fn()

    const unsubscribe = runtime.subscribe(listener)

    runtime.init()
    runtime.generate("request-1", [{ role: "user", content: "hello" }])
    runtime.stop()
    runtime.reset()

    worker.emitWorkerEvent({
      type: "ready",
      device: "wasm",
      dtype: "q4",
      modelId: "demo",
    })

    expect(worker.messages).toEqual([
      { type: "init" },
      {
        type: "generate",
        requestId: "request-1",
        messages: [{ role: "user", content: "hello" }],
      },
      { type: "stop" },
      { type: "reset" },
    ])
    expect(listener).toHaveBeenCalledWith({
      type: "ready",
      device: "wasm",
      dtype: "q4",
      modelId: "demo",
    })

    unsubscribe()
    runtime.dispose()
  })
})
