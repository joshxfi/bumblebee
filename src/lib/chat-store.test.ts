import { describe, expect, it, vi } from "vitest"

import { applyWorkerEvent, createChatStore } from "@/lib/chat-store"
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
    generate: vi.fn((requestId, modelId, messages) => {
      events.push({ type: "generate", payload: { requestId, modelId, messages } })
    }),
    init: vi.fn((modelId) => {
      events.push({ type: "init", payload: { modelId } })
    }),
    recreateWorker: vi.fn(() => {
      events.push({ type: "recreateWorker" })
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
  it("queues a user turn and requests generation with the selected model", () => {
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
    expect(runtime.generate).toHaveBeenCalledWith(
      expect.any(String),
      state.selectedModelId,
      expect.any(Array)
    )
  })

  it("hydrates streaming chunks and completes back to ready", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().sendMessage("Give me a concise summary.")
    const requestId = store.getState().activeRequestId
    const modelId = store.getState().selectedModelId

    applyWorkerEvent(store, {
      type: "ready",
      modelId,
      device: "wasm",
      dtype: "q4",
    })
    applyWorkerEvent(store, {
      type: "token",
      modelId,
      requestId: requestId!,
      text: "Local inference keeps data in the browser.",
    })
    applyWorkerEvent(store, {
      type: "complete",
      modelId,
      requestId: requestId!,
      finishReason: "completed",
    })

    const assistant = store.getState().messages.at(-1)

    expect(store.getState().runtimeStatus).toBe("ready")
    expect(store.getState().hasLoadedModel).toBe(true)
    expect(assistant?.content).toContain("Local inference")
    expect(assistant?.state).toBe("done")
  })

  it("resets state and recreates the worker when switching models", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().sendMessage("Write a slogan.")
    store.getState().setSelectedModel("smollm2-135m")

    expect(runtime.reset).toHaveBeenCalledTimes(1)
    expect(runtime.recreateWorker).toHaveBeenCalledTimes(1)
    expect(store.getState().messages).toHaveLength(0)
    expect(store.getState().runtimeStatus).toBe("idle")
    expect(store.getState().selectedModelId).toBe("smollm2-135m")
    expect(store.getState().hasLoadedModel).toBe(false)
  })

  it("defaults constrained devices to the smaller model and rejects the desktop model", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime, { deviceProfile: "constrained" })

    expect(store.getState().selectedModelId).toBe("smollm2-135m")
    expect(
      store.getState().availableModels.find((model) => model.id === "lfm2-350m")
        ?.disabled
    ).toBe(true)

    store.getState().setSelectedModel("lfm2-350m")

    expect(store.getState().selectedModelId).toBe("smollm2-135m")
    expect(runtime.recreateWorker).not.toHaveBeenCalled()
  })

  it("ignores stale worker events from a previous model", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().sendMessage("Trigger stale events.")
    const requestId = store.getState().activeRequestId

    applyWorkerEvent(store, {
      type: "token",
      modelId: "smollm2-135m",
      requestId: requestId!,
      text: "stale",
    } satisfies WorkerEvent)

    expect(store.getState().messages.at(-1)?.content).toBe("")
  })
})
