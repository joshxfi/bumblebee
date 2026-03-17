import { describe, expect, it, vi } from "vitest"

import { ChatRuntimeClient } from "@/lib/chat-runtime"
import type { WorkerEvent, WorkerRequest } from "@/lib/chat-types"

class WorkerDouble extends EventTarget {
  messages: WorkerRequest[] = []
  terminated = false

  postMessage(payload: WorkerRequest) {
    this.messages.push(payload)
  }

  terminate() {
    this.terminated = true
  }

  emitWorkerEvent(payload: WorkerEvent) {
    this.dispatchEvent(new MessageEvent("message", { data: payload }))
  }
}

describe("chat runtime", () => {
  it("posts model-aware worker commands and relays worker events", () => {
    const worker = new WorkerDouble()
    const runtime = new ChatRuntimeClient(() => worker as unknown as Worker)
    const listener = vi.fn()

    const unsubscribe = runtime.subscribe(listener)

    runtime.init("lfm2-350m")
    runtime.generate("request-1", "lfm2-350m", [
      { role: "user", content: "hello" },
    ])
    runtime.stop()
    runtime.reset()

    worker.emitWorkerEvent({
      type: "ready",
      modelId: "lfm2-350m",
      device: "wasm",
      dtype: "q4",
    })

    expect(worker.messages).toEqual([
      { type: "init", modelId: "lfm2-350m" },
      {
        type: "generate",
        modelId: "lfm2-350m",
        requestId: "request-1",
        messages: [{ role: "user", content: "hello" }],
      },
      { type: "stop" },
      { type: "reset" },
    ])
    expect(listener).toHaveBeenCalledWith({
      type: "ready",
      modelId: "lfm2-350m",
      device: "wasm",
      dtype: "q4",
    })

    unsubscribe()
    runtime.dispose()
  })

  it("recreates the worker when asked", () => {
    const firstWorker = new WorkerDouble()
    const secondWorker = new WorkerDouble()
    const createWorker = vi
      .fn<() => WorkerDouble>()
      .mockReturnValueOnce(firstWorker)
      .mockReturnValueOnce(secondWorker)

    const runtime = new ChatRuntimeClient(
      createWorker as unknown as () => Worker
    )

    runtime.init("lfm2-350m")
    runtime.recreateWorker()
    runtime.init("smollm2-135m")

    expect(firstWorker.terminated).toBe(true)
    expect(secondWorker.messages).toEqual([
      { type: "init", modelId: "smollm2-135m" },
    ])

    runtime.dispose()
  })
})
