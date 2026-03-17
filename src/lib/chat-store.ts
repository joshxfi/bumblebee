import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"

import { CHAT_MODEL_CONFIG } from "@/lib/chat-config"
import { getDefaultChatRuntime, type ChatRuntime } from "@/lib/chat-runtime"
import type {
  ChatDevice,
  ChatMessage,
  ChatMessageState,
  ModelLoadProgress,
  ModelMessage,
  RuntimeStatus,
  WorkerEvent,
} from "@/lib/chat-types"

type ChatStoreState = {
  activeAssistantId: string | null
  activeDevice: ChatDevice | null
  activeRequestId: string | null
  composer: string
  error: string | null
  hasLoadedModel: boolean
  loadProgress: ModelLoadProgress | null
  messages: ChatMessage[]
  pendingStop: boolean
  runtimeStatus: RuntimeStatus
  clearChat: () => void
  dismissError: () => void
  initModel: () => void
  retryLastTurn: () => void
  sendMessage: (value?: string) => void
  setComposer: (value: string) => void
  stopGeneration: () => void
}

type MutableChatState = Omit<
  ChatStoreState,
  | "clearChat"
  | "dismissError"
  | "initModel"
  | "retryLastTurn"
  | "sendMessage"
  | "setComposer"
  | "stopGeneration"
>

const initialLoadProgress: ModelLoadProgress = {
  phase: "Warm up",
  progress: 0,
  detail: "Fetching tokenizer and model shards...",
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createChatMessage(
  role: ChatMessage["role"],
  content: string,
  state: ChatMessageState
): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    createdAt: Date.now(),
    state,
  }
}

function appendAssistantChunk(
  messages: ChatMessage[],
  activeAssistantId: string | null,
  chunk: string
): ChatMessage[] {
  if (!chunk) {
    return messages
  }

  if (!activeAssistantId) {
    return [...messages, createChatMessage("assistant", chunk, "streaming")]
  }

  return messages.map((message) =>
    message.id === activeAssistantId
      ? {
          ...message,
          content: `${message.content}${chunk}`,
          state: "streaming",
        }
      : message
  )
}

function finalizeAssistantMessage(
  messages: ChatMessage[],
  activeAssistantId: string | null,
  nextState: ChatMessageState,
  dropIfEmpty = false
): ChatMessage[] {
  if (!activeAssistantId) {
    return messages
  }

  return messages.flatMap((message) => {
    if (message.id !== activeAssistantId) {
      return [message]
    }

    if (dropIfEmpty && message.content.trim().length === 0) {
      return []
    }

    return [{ ...message, state: nextState }]
  })
}

function pruneConversation(messages: ChatMessage[]) {
  return messages.filter((message) => {
    if (message.role !== "assistant") {
      return true
    }

    return message.content.trim().length > 0 && message.state !== "error"
  })
}

function dropLastAssistantTurn(messages: ChatMessage[]) {
  const nextMessages = [...messages]

  while (nextMessages.at(-1)?.role === "assistant") {
    nextMessages.pop()
  }

  return nextMessages
}

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return pruneConversation(messages).map(({ role, content }) => ({
    role,
    content,
  }))
}

function getBusyStatus(hasLoadedModel: boolean): RuntimeStatus {
  return hasLoadedModel ? "generating" : "loading-model"
}

function createBaseState(): MutableChatState {
  return {
    activeAssistantId: null,
    activeDevice: null,
    activeRequestId: null,
    composer: "",
    error: null,
    hasLoadedModel: false,
    loadProgress: null,
    messages: [],
    pendingStop: false,
    runtimeStatus: "idle",
  }
}

export function createChatStore(runtime: ChatRuntime) {
  return createStore<ChatStoreState>((set, get) => ({
    ...createBaseState(),
    clearChat: () => {
      runtime.reset()

      set((state) => ({
        ...state,
        activeAssistantId: null,
        activeRequestId: null,
        composer: "",
        error: null,
        messages: [],
        pendingStop: false,
        runtimeStatus: state.hasLoadedModel ? "ready" : "idle",
      }))
    },
    dismissError: () => {
      set((state) => ({
        error: null,
        runtimeStatus:
          state.activeAssistantId !== null
            ? "generating"
            : state.hasLoadedModel
              ? "ready"
              : "idle",
      }))
    },
    initModel: () => {
      const state = get()
      if (
        state.hasLoadedModel ||
        state.runtimeStatus === "loading-model" ||
        state.runtimeStatus === "generating"
      ) {
        return
      }

      set({
        error: null,
        loadProgress: state.loadProgress ?? initialLoadProgress,
        runtimeStatus: "loading-model",
      })
      runtime.init()
    },
    retryLastTurn: () => {
      const state = get()
      if (
        state.runtimeStatus === "generating" ||
        state.runtimeStatus === "loading-model"
      ) {
        return
      }

      const history = dropLastAssistantTurn(pruneConversation(state.messages))
      if (history.at(-1)?.role !== "user") {
        return
      }

      const assistantMessage = createChatMessage("assistant", "", "streaming")

      set({
        activeAssistantId: assistantMessage.id,
        activeRequestId: assistantMessage.id,
        error: null,
        messages: [...history, assistantMessage],
        pendingStop: false,
        runtimeStatus: getBusyStatus(state.hasLoadedModel),
      })

      runtime.generate(assistantMessage.id, toModelMessages(history))
    },
    sendMessage: (value) => {
      const state = get()
      if (
        state.runtimeStatus === "generating" ||
        state.runtimeStatus === "loading-model"
      ) {
        return
      }

      const nextComposer = (value ?? state.composer).trim()
      if (!nextComposer) {
        return
      }

      const baseMessages = pruneConversation(state.messages)
      const userMessage = createChatMessage("user", nextComposer, "done")
      const assistantMessage = createChatMessage("assistant", "", "streaming")
      const nextMessages = [...baseMessages, userMessage, assistantMessage]

      set({
        activeAssistantId: assistantMessage.id,
        activeRequestId: assistantMessage.id,
        composer: value === undefined ? "" : state.composer,
        error: null,
        loadProgress: state.hasLoadedModel
          ? state.loadProgress
          : (state.loadProgress ?? initialLoadProgress),
        messages: nextMessages,
        pendingStop: false,
        runtimeStatus: getBusyStatus(state.hasLoadedModel),
      })

      runtime.generate(assistantMessage.id, toModelMessages(nextMessages))
    },
    setComposer: (value) => {
      set({ composer: value })
    },
    stopGeneration: () => {
      if (get().runtimeStatus !== "generating") {
        return
      }

      set({ pendingStop: true })
      runtime.stop()
    },
  }))
}

export function applyWorkerEvent(
  store: StoreApi<ChatStoreState>,
  event: WorkerEvent
) {
  switch (event.type) {
    case "progress": {
      store.setState((state) => ({
        error: null,
        loadProgress: event.progress,
        runtimeStatus:
          state.activeAssistantId !== null ? "loading-model" : "loading-model",
      }))
      return
    }

    case "ready": {
      store.setState((state) => ({
        activeDevice: event.device,
        error: null,
        hasLoadedModel: true,
        loadProgress: {
          phase: "Ready",
          progress: 100,
          detail: `${CHAT_MODEL_CONFIG.label} is loaded on ${event.device.toUpperCase()}.`,
        },
        runtimeStatus: state.activeAssistantId ? "generating" : "ready",
      }))
      return
    }

    case "token": {
      store.setState((state) => {
        if (
          state.activeRequestId !== null &&
          state.activeRequestId !== event.requestId
        ) {
          return state
        }

        return {
          error: null,
          messages: appendAssistantChunk(
            state.messages,
            state.activeAssistantId,
            event.text
          ),
          runtimeStatus: "generating" as const,
        }
      })
      return
    }

    case "complete": {
      store.setState((state) => {
        if (
          state.activeRequestId !== null &&
          state.activeRequestId !== event.requestId
        ) {
          return state
        }

        return {
          activeAssistantId: null,
          activeRequestId: null,
          error: null,
          messages: finalizeAssistantMessage(
            state.messages,
            state.activeAssistantId,
            "done",
            event.finishReason === "stopped"
          ),
          pendingStop: false,
          runtimeStatus: state.hasLoadedModel ? "ready" : "idle",
        }
      })
      return
    }

    case "error": {
      store.setState((state) => {
        const shouldHandleActiveRequest =
          !event.requestId || state.activeRequestId === event.requestId

        return {
          activeAssistantId: shouldHandleActiveRequest
            ? null
            : state.activeAssistantId,
          activeRequestId: shouldHandleActiveRequest
            ? null
            : state.activeRequestId,
          error: event.error,
          messages: shouldHandleActiveRequest
            ? finalizeAssistantMessage(
                state.messages,
                state.activeAssistantId,
                "error"
              )
            : state.messages,
          pendingStop: false,
          runtimeStatus: "error",
        }
      })
    }
  }
}

export function bindChatRuntime(
  store: StoreApi<ChatStoreState>,
  runtime: ChatRuntime
) {
  return runtime.subscribe((event) => {
    applyWorkerEvent(store, event)
  })
}

const runtime = getDefaultChatRuntime()

export const chatStore = createChatStore(runtime)

bindChatRuntime(chatStore, runtime)

export function useChatStore<T>(selector: (state: ChatStoreState) => T) {
  return useStore(chatStore, selector)
}

export type { ChatStoreState }
