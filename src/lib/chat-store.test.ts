import { describe, expect, it, vi } from "vitest";
import type { ChatRuntime } from "@/lib/chat-runtime";
import { applyWorkerEvent, createChatStore } from "@/lib/chat-store";
import type { WorkerEvent } from "@/lib/chat-types";

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

function requireRequestId(id: string | null | undefined): string {
  if (id === undefined || id === null) {
    throw new Error("expected activeRequestId");
  }

  return id;
}

function createRuntimeStub(
  options: { autoCompleteCompaction?: boolean } = {},
): ChatRuntime & {
  events: Array<{ type: string; payload?: unknown }>;
  listeners: Set<(event: WorkerEvent) => void>;
} {
  const { autoCompleteCompaction = true } = options;
  const events: Array<{ type: string; payload?: unknown }> = [];
  const listeners = new Set<(event: WorkerEvent) => void>();

  // Mirror ChatRuntimeClient: tearing the worker down releases in-flight
  // awaiters (e.g. context compaction) with a synthetic abort event.
  const emitAborted = () => {
    for (const listener of [...listeners]) {
      listener({ type: "aborted" });
    }
  };

  return {
    events,
    listeners,
    subscribe: vi.fn((listener: (event: WorkerEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    dispose: () => undefined,
    generate: vi.fn((requestId, modelId, messages, options) => {
      events.push({
        type: "generate",
        payload: { requestId, modelId, messages, options },
      });
      queueMicrotask(() => {
        if (
          autoCompleteCompaction &&
          String(requestId).startsWith("compact-")
        ) {
          for (const listener of listeners) {
            listener({
              type: "complete",
              finishReason: "completed",
              generatedTokens: 4,
              modelId,
              requestId,
            });
          }
        }
      });
    }),
    init: vi.fn((modelId) => {
      events.push({ type: "init", payload: { modelId } });
    }),
    recreateWorker: vi.fn(() => {
      events.push({ type: "recreateWorker" });
      emitAborted();
    }),
    reset: vi.fn(() => {
      events.push({ type: "reset" });
      emitAborted();
    }),
    stop: vi.fn(() => {
      events.push({ type: "stop" });
    }),
  };
}

describe("chat store", () => {
  it("clears isCompactingContext when the conversation is cleared", () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.setState({
      isCompactingContext: true,
      messages: [],
      runtimeStatus: "ready",
    });

    store.getState().clearChat();

    expect(store.getState().isCompactingContext).toBe(false);
  });

  it("queues a user turn and requests generation with the selected model", async () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().setComposer("Explain local inference in one paragraph.");
    store.getState().sendMessage();

    const state = store.getState();

    expect(state.composer).toBe("");
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]?.role).toBe("user");
    expect(state.messages[1]?.role).toBe("assistant");
    expect(state.messages[1]?.state).toBe("streaming");
    expect(state.runtimeStatus).toBe("loading-model");

    await flushMicrotasks();

    expect(runtime.generate).toHaveBeenCalledWith(
      expect.any(String),
      state.selectedModelId,
      expect.any(Array),
      expect.anything(),
    );
  });

  it("cancels an in-flight model load and restores an uncommitted send turn", () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().setComposer("Explain local inference in one paragraph.");
    store.getState().sendMessage();
    expect(store.getState().runtimeStatus).toBe("loading-model");

    store.getState().cancelModelLoad();

    const state = store.getState();
    expect(state.runtimeStatus).toBe("idle");
    expect(state.messages).toHaveLength(0);
    expect(state.composer).toBe("Explain local inference in one paragraph.");
    expect(state.activeAssistantId).toBeNull();
    expect(state.activeRequestId).toBeNull();
    expect(state.loadProgress).toBeNull();
    expect(runtime.reset).toHaveBeenCalled();
    expect(runtime.recreateWorker).toHaveBeenCalled();
  });

  it("cancels prepare-only load without touching composer when empty", () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().initModel();
    expect(store.getState().runtimeStatus).toBe("loading-model");

    store.getState().cancelModelLoad();

    expect(store.getState().runtimeStatus).toBe("idle");
    expect(store.getState().messages).toHaveLength(0);
    expect(store.getState().composer).toBe("");
    expect(runtime.reset).toHaveBeenCalled();
    expect(runtime.recreateWorker).toHaveBeenCalled();
  });

  it("hydrates streaming chunks and completes back to ready", () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().sendMessage("Give me a concise summary.");
    const requestId = store.getState().activeRequestId;
    const modelId = store.getState().selectedModelId;

    applyWorkerEvent(store, {
      type: "ready",
      modelId,
      device: "wasm",
      dtype: "q4",
    });
    applyWorkerEvent(store, {
      type: "token",
      modelId,
      requestId: requireRequestId(requestId),
      text: "Local inference keeps data in the browser.",
    });
    applyWorkerEvent(store, {
      type: "complete",
      generatedTokens: 12,
      modelId,
      requestId: requireRequestId(requestId),
      finishReason: "completed",
    });

    const assistant = store.getState().messages.at(-1);

    expect(store.getState().runtimeStatus).toBe("ready");
    expect(store.getState().hasLoadedModel).toBe(true);
    expect(assistant?.content).toContain("Local inference");
    expect(assistant?.state).toBe("done");
    expect(assistant?.finishReason).toBe("completed");
  });

  it("marks responses that stop at the token limit and continues the same assistant turn", async () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().sendMessage("Write a longer answer.");
    const requestId = store.getState().activeRequestId;
    const modelId = store.getState().selectedModelId;

    applyWorkerEvent(store, {
      type: "token",
      modelId,
      requestId: requireRequestId(requestId),
      text: "This answer is still going",
    });
    applyWorkerEvent(store, {
      type: "complete",
      generatedTokens: 24,
      modelId,
      requestId: requireRequestId(requestId),
      finishReason: "length",
    });

    const truncatedAssistant = store.getState().messages.at(-1);
    expect(truncatedAssistant?.finishReason).toBe("length");
    expect(truncatedAssistant?.state).toBe("done");

    store.getState().continueLastResponse();

    const continuedAssistant = store.getState().messages.at(-1);
    expect(continuedAssistant?.id).toBe(truncatedAssistant?.id);
    expect(continuedAssistant?.state).toBe("streaming");

    await flushMicrotasks();

    expect(runtime.generate).toHaveBeenLastCalledWith(
      truncatedAssistant?.id,
      modelId,
      expect.arrayContaining([
        {
          role: "user",
          content:
            "Continue your last response from where it stopped. Do not repeat prior text.",
        },
      ]),
      expect.anything(),
    );
  });

  it("preserves conversation and recreates the worker when switching models", async () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().sendMessage("Write a slogan.");
    await flushMicrotasks();

    const requestId = store.getState().activeRequestId;
    const previousModelId = store.getState().selectedModelId;
    applyWorkerEvent(store, {
      type: "token",
      modelId: previousModelId,
      requestId: requireRequestId(requestId),
      text: "Think different.",
    });

    store.getState().setSelectedModel("smollm2-135m");

    expect(runtime.reset).toHaveBeenCalledTimes(1);
    expect(runtime.recreateWorker).toHaveBeenCalledTimes(1);
    expect(store.getState().messages).toHaveLength(2);
    expect(store.getState().messages[0]?.role).toBe("user");
    expect(store.getState().messages[1]?.role).toBe("assistant");
    expect(store.getState().messages[1]?.state).toBe("done");
    expect(store.getState().messages[1]?.finishReason).toBe("stopped");
    expect(store.getState().messages[1]?.content).toContain("Think different.");
    expect(store.getState().runtimeStatus).toBe("idle");
    expect(store.getState().selectedModelId).toBe("smollm2-135m");
    expect(store.getState().hasLoadedModel).toBe(false);
  });

  it("finalizes streaming assistant when switching models mid-generation", async () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().sendMessage("Hello");
    await flushMicrotasks();

    const requestId = store.getState().activeRequestId;
    const oldModelId = store.getState().selectedModelId;

    applyWorkerEvent(store, {
      type: "token",
      modelId: oldModelId,
      requestId: requireRequestId(requestId),
      text: "Partial reply",
    });

    expect(store.getState().runtimeStatus).toBe("generating");

    store.getState().setSelectedModel("smollm2-135m");

    const assistant = store.getState().messages.at(-1);
    expect(assistant?.state).toBe("done");
    expect(assistant?.finishReason).toBe("stopped");
    expect(assistant?.content).toContain("Partial reply");
    expect(store.getState().selectedModelId).toBe("smollm2-135m");
    expect(store.getState().activeAssistantId).toBeNull();
  });

  it("defaults constrained devices to Falcon H1 Tiny 90M but still allows larger mobile models", () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime, { deviceProfile: "constrained" });

    expect(store.getState().selectedModelId).toBe(
      "falcon-h1-tiny-90m-instruct",
    );
    expect(store.getState().availableModels.map((model) => model.id)).toEqual([
      "smollm2-135m",
      "smollm2-360m",
      "gemma-3-270m-it",
      "qwen2.5-0.5b",
      "qwen3-0.6b",
      "falcon-h1-tiny-90m-instruct",
      "falcon-h1-tiny-multilingual-100m-instruct",
      "lfm2-5-350m",
      "lfm2-350m",
      "lfm2-700m",
      "llama-3.2-1b-instruct",
      "gemma-3-1b-it",
      "lfm2-1.2b",
      "tinyswallow-1.5b-instruct",
      "bonsai-1.7b",
      "lfm2-2.6b",
      "granite-4.0-350m",
      "granite-4.0-1b",
    ]);
    expect(
      store
        .getState()
        .availableModels.find((model) => model.id === "lfm2-5-350m")?.disabled,
    ).toBe(false);
    for (const modelId of [
      "lfm2-700m",
      "llama-3.2-1b-instruct",
      "gemma-3-1b-it",
      "lfm2-1.2b",
      "tinyswallow-1.5b-instruct",
      "bonsai-1.7b",
      "lfm2-2.6b",
      "granite-4.0-1b",
    ] as const) {
      expect(
        store.getState().availableModels.find((model) => model.id === modelId)
          ?.disabled,
      ).toBe(true);
    }
    store.getState().setSelectedModel("lfm2-350m");

    expect(store.getState().selectedModelId).toBe("lfm2-350m");
    expect(runtime.recreateWorker).toHaveBeenCalledTimes(1);
  });

  it("keeps LFM2.5 350M as the desktop default while exposing the full model ladder", () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime, { deviceProfile: "standard" });

    expect(store.getState().selectedModelId).toBe("lfm2-5-350m");
    expect(
      store.getState().availableModels.map((model) => model.label),
    ).toEqual([
      "SmolLM2 135M",
      "SmolLM2 360M",
      "Gemma 3 270M",
      "Qwen2.5 0.5B",
      "Qwen3 0.6B",
      "Falcon H1 Tiny 90M",
      "Falcon H1 Tiny Multilingual 100M",
      "LFM2.5 350M",
      "LFM2 350M",
      "LFM2 700M",
      "Llama 3.2 1B",
      "Gemma 3 1B",
      "LFM2 1.2B",
      "TinySwallow 1.5B",
      "Bonsai 1.7B",
      "LFM2 2.6B",
      "Granite 4.0 350M",
      "Granite 4.0 1B",
    ]);
  });

  it("trims model history to the configured recent turn window", async () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.setState({
      messages: Array.from({ length: 14 }, (_, index) => ({
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
    });

    store.getState().sendMessage("Newest turn");

    await flushMicrotasks();

    expect(runtime.generate).toHaveBeenLastCalledWith(
      expect.any(String),
      "lfm2-5-350m",
      expect.arrayContaining([
        { role: "user", content: "User turn 1" },
        { role: "assistant", content: "Assistant turn 1" },
        { role: "user", content: "Newest turn" },
      ]),
      expect.anything(),
    );

    const payload = runtime.events.at(-1)?.payload as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(
      payload.messages.find((message) => message.content === "User turn 1"),
    ).toBeDefined();
    expect(
      payload.messages.filter((message) => message.role === "user"),
    ).toHaveLength(8);
  });

  it("runs compaction summarization before main generation when turns fall off the window", async () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

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
    });

    store.getState().sendMessage("Newest turn");

    await flushMicrotasks();

    expect(runtime.generate).toHaveBeenCalledTimes(2);

    const firstCall = vi.mocked(runtime.generate).mock.calls[0];
    expect(String(firstCall?.[0]).startsWith("compact-")).toBe(true);
    expect(firstCall?.[3]).toMatchObject({
      generationOverrides: expect.objectContaining({
        max_new_tokens: 160,
        temperature: 0.35,
      }),
    });

    expect(runtime.generate).toHaveBeenLastCalledWith(
      expect.any(String),
      "lfm2-5-350m",
      expect.arrayContaining([
        { role: "user", content: "User turn 3" },
        { role: "assistant", content: "Assistant turn 3" },
        { role: "user", content: "Newest turn" },
      ]),
      expect.objectContaining({
        compactionDroppedChars: expect.any(Number),
        compactionSummarizeMs: expect.any(Number),
      }),
    );

    const mainPayload = vi.mocked(runtime.generate).mock
      .calls[1]?.[2] as Array<{
      role: string;
      content: string;
    }>;

    expect(
      mainPayload.find((message) => message.content === "User turn 1"),
    ).toBeUndefined();
    expect(
      mainPayload.filter((message) => message.role === "user"),
    ).toHaveLength(8);
  });

  it("ignores stale worker events from a previous model", () => {
    const runtime = createRuntimeStub();
    const store = createChatStore(runtime);

    store.getState().sendMessage("Trigger stale events.");
    const requestId = store.getState().activeRequestId;

    applyWorkerEvent(store, {
      type: "token",
      modelId: "smollm2-135m",
      requestId: requireRequestId(requestId),
      text: "stale",
    } satisfies WorkerEvent);

    expect(store.getState().messages.at(-1)?.content).toBe("");
  });

  it("does not start a stale generation when switching models mid-compaction", async () => {
    const runtime = createRuntimeStub({ autoCompleteCompaction: false });
    const store = createChatStore(runtime);

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
    });

    store.getState().sendMessage("Newest turn");
    await flushMicrotasks();

    // Summarization is in-flight (only the compaction request has been sent).
    expect(runtime.generate).toHaveBeenCalledTimes(1);
    expect(
      String(vi.mocked(runtime.generate).mock.calls[0]?.[0]).startsWith(
        "compact-",
      ),
    ).toBe(true);
    expect(store.getState().isCompactingContext).toBe(true);

    // User switches model before the summary returns. The recreateWorker abort
    // settles the pending summary, and the epoch guard must drop the result.
    store.getState().setSelectedModel("smollm2-135m");
    await flushMicrotasks();

    // No main generation fired, no stray streaming message left behind.
    expect(runtime.generate).toHaveBeenCalledTimes(1);
    expect(store.getState().isCompactingContext).toBe(false);
    expect(store.getState().selectedModelId).toBe("smollm2-135m");
    expect(
      store
        .getState()
        .messages.some((message) => message.state === "streaming"),
    ).toBe(false);
    expect(store.getState().messages.at(-1)?.content).toBe("Newest turn");
  });

  it("settles compaction and clears state when the chat is cleared mid-compaction", async () => {
    const runtime = createRuntimeStub({ autoCompleteCompaction: false });
    const store = createChatStore(runtime);

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
    });

    store.getState().sendMessage("Newest turn");
    await flushMicrotasks();
    expect(runtime.generate).toHaveBeenCalledTimes(1);

    store.getState().clearChat();
    await flushMicrotasks();

    // The stranded summary must not append a stray message into the cleared chat.
    expect(runtime.generate).toHaveBeenCalledTimes(1);
    expect(store.getState().messages).toHaveLength(0);
    expect(store.getState().isCompactingContext).toBe(false);
  });
});
