import { describe, expect, it, vi } from "vitest"

import { createChatStore, applyWorkerEvent } from "@/lib/chat-store"
import type { ChatRuntime } from "@/lib/chat-runtime"
import type { WorkerEvent } from "@/lib/chat-types"

function createRuntimeStub(): ChatRuntime & {
  events: Array<{ type: string; payload?: unknown }>
} {
  const events: Array<{ type: string; payload?: unknown }> = []

  return {
    events,
    subscribe: () => () => undefined,
    dispose: () => undefined,
    generate: vi.fn((requestId, messages) => {
      events.push({ type: "generate", payload: { requestId, messages } })
    }),
    init: vi.fn(() => {
      events.push({ type: "init" })
    }),
    reset: vi.fn(() => {
      events.push({ type: "reset" })
    }),
    stop: vi.fn(() => {
      events.push({ type: "stop" })
    }),
  }
}

describe("chat store", () => {
  it("queues a user turn and requests generation", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().setComposer("Explain local inference in one paragraph.")
    store.getState().sendMessage()

    const state = store.getState()

    expect(state.composer).toBe("")
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0]?.role).toBe("user")
    expect(state.messages[1]?.role).toBe("assistant")
    expect(state.messages[1]?.state).toBe("streaming")
    expect(state.runtimeStatus).toBe("loading-model")
    expect(runtime.generate).toHaveBeenCalledTimes(1)
  })

  it("hydrates streaming chunks and completes back to ready", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().sendMessage("Give me a concise summary.")
    const requestId = store.getState().activeRequestId

    applyWorkerEvent(store, {
      type: "ready",
      device: "wasm",
      dtype: "q4",
      modelId: "demo",
    })
    applyWorkerEvent(store, {
      type: "token",
      requestId: requestId!,
      text: "Local inference keeps data in the browser.",
    })
    applyWorkerEvent(store, {
      type: "complete",
      requestId: requestId!,
      finishReason: "completed",
    })

    const assistant = store.getState().messages.at(-1)

    expect(store.getState().runtimeStatus).toBe("ready")
    expect(store.getState().hasLoadedModel).toBe(true)
    expect(assistant?.content).toContain("Local inference")
    expect(assistant?.state).toBe("done")
  })

  it("stops generation and clears the thread without unloading the model", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().sendMessage("Write a slogan.")
    store.setState({ hasLoadedModel: true, runtimeStatus: "generating" })
    store.getState().stopGeneration()
    store.getState().clearChat()

    expect(runtime.stop).toHaveBeenCalledTimes(1)
    expect(runtime.reset).toHaveBeenCalledTimes(1)
    expect(store.getState().messages).toHaveLength(0)
    expect(store.getState().runtimeStatus).toBe("ready")
  })

  it("records worker errors against the active assistant turn", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().sendMessage("Trigger an error.")
    const requestId = store.getState().activeRequestId

    applyWorkerEvent(store, {
      type: "error",
      requestId: requestId!,
      error: "Model execution failed.",
    } satisfies WorkerEvent)

    const assistant = store.getState().messages.at(-1)

    expect(store.getState().runtimeStatus).toBe("error")
    expect(store.getState().error).toBe("Model execution failed.")
    expect(assistant?.state).toBe("error")
  })
})
