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
      generatedTokens: 12,
      modelId,
      requestId: requestId!,
      finishReason: "completed",
    })

    const assistant = store.getState().messages.at(-1)

    expect(store.getState().runtimeStatus).toBe("ready")
    expect(store.getState().hasLoadedModel).toBe(true)
    expect(assistant?.content).toContain("Local inference")
    expect(assistant?.state).toBe("done")
    expect(assistant?.finishReason).toBe("completed")
  })

  it("marks responses that stop at the token limit and continues the same assistant turn", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.getState().sendMessage("Write a longer answer.")
    const requestId = store.getState().activeRequestId
    const modelId = store.getState().selectedModelId

    applyWorkerEvent(store, {
      type: "token",
      modelId,
      requestId: requestId!,
      text: "This answer is still going",
    })
    applyWorkerEvent(store, {
      type: "complete",
      generatedTokens: 24,
      modelId,
      requestId: requestId!,
      finishReason: "length",
    })

    const truncatedAssistant = store.getState().messages.at(-1)
    expect(truncatedAssistant?.finishReason).toBe("length")
    expect(truncatedAssistant?.state).toBe("done")

    store.getState().continueLastResponse()

    const continuedAssistant = store.getState().messages.at(-1)
    expect(continuedAssistant?.id).toBe(truncatedAssistant?.id)
    expect(continuedAssistant?.state).toBe("streaming")
    expect(runtime.generate).toHaveBeenLastCalledWith(
      truncatedAssistant?.id,
      modelId,
      expect.arrayContaining([
        {
          role: "user",
          content:
            "Continue your last response from where it stopped. Do not repeat prior text.",
        },
      ])
    )
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

  it("defaults constrained devices to the smaller model but still allows the desktop model", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime, { deviceProfile: "constrained" })

    expect(store.getState().selectedModelId).toBe("smollm2-135m")
    expect(store.getState().availableModels.map((model) => model.id)).toEqual([
      "smollm2-135m",
      "smollm2-360m",
      "lfm2-350m",
      "qwen2.5-0.5b",
      "lfm2-700m",
      "lfm2-1.2b",
      "bonsai-1.7b",
    ])
    expect(
      store.getState().availableModels.find((model) => model.id === "lfm2-350m")
        ?.disabled
    ).toBe(false)
    expect(
      store.getState().availableModels.find((model) => model.id === "lfm2-700m")
        ?.disabled
    ).toBe(true)
    expect(
      store.getState().availableModels.find((model) => model.id === "lfm2-1.2b")
        ?.disabled
    ).toBe(true)
    expect(
      store.getState().availableModels.find((model) => model.id === "bonsai-1.7b")
        ?.disabled
    ).toBe(true)
    store.getState().setSelectedModel("lfm2-350m")

    expect(store.getState().selectedModelId).toBe("lfm2-350m")
    expect(runtime.recreateWorker).toHaveBeenCalledTimes(1)
  })

  it("keeps the balanced desktop default while exposing the full model ladder", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime, { deviceProfile: "standard" })

    expect(store.getState().selectedModelId).toBe("lfm2-350m")
    expect(store.getState().availableModels.map((model) => model.label)).toEqual([
      "SmolLM2 135M",
      "SmolLM2 360M",
      "LFM2 350M",
      "Qwen2.5 0.5B",
      "LFM2 700M",
      "LFM2 1.2B",
      "Bonsai 1.7B",
    ])
  })

  it("trims model history to the configured recent turn window", () => {
    const runtime = createRuntimeStub()
    const store = createChatStore(runtime)

    store.setState({
      messages: Array.from({ length: 18 }, (_, index) => ({
        content:
          index % 2 === 0
            ? `User turn ${index / 2 + 1}`
            : `Assistant turn ${Math.ceil(index / 2)}`,
        createdAt: index,
        id: `message-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        state: "done",
      })),
      runtimeStatus: "ready",
    })

    store.getState().sendMessage("Newest turn")

    expect(runtime.generate).toHaveBeenLastCalledWith(
      expect.any(String),
      "lfm2-350m",
      expect.arrayContaining([
        { role: "user", content: "User turn 3" },
        { role: "assistant", content: "Assistant turn 3" },
        { role: "user", content: "Newest turn" },
      ])
    )

    const payload = runtime.events.at(-1)?.payload as {
      messages: Array<{ role: string; content: string }>
    }

    expect(payload.messages.find((message) => message.content === "User turn 1")).toBeUndefined()
    expect(payload.messages.filter((message) => message.role === "user")).toHaveLength(8)
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
