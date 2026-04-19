import { useStore } from "zustand"
import { createStore, type StoreApi } from "zustand/vanilla"

import {
  getDefaultChatRuntime,
  type ChatRuntime,
} from "@/lib/chat-runtime"
import {
  getDeviceProfile,
  getModelConfig,
  getModelOptions,
  getRecommendedModelId,
} from "@/lib/chat-config"
import {
  buildCompactionSummarizeMessages,
  buildSystemSummaryMessage,
  chatMessagesToModelMessages,
  clampCompactionSummary,
  mergeDroppedMessages,
  pruneConversation,
  serializeMessagesForSummary,
  trimToCharBudget,
  trimTurnWindow,
} from "@/lib/context-compaction"
import type {
  ChatDevice,
  ChatMessage,
  ChatMessageState,
  ChatModelId,
  ChatModelOption,
  DeviceProfile,
  FinishReason,
  ModelLoadProgress,
  ModelMessage,
  RuntimeStatus,
  WorkerEvent,
} from "@/lib/chat-types"

type ChatStoreState = {
  activeAssistantId: string | null
  activeDevice: ChatDevice | null
  activeRequestId: string | null
  availableModels: ChatModelOption[]
  composer: string
  deviceProfile: DeviceProfile
  error: string | null
  hasLoadedModel: boolean
  loadProgress: ModelLoadProgress | null
  messages: ChatMessage[]
  pendingStop: boolean
  rollingContextSummary: string
  runtimeStatus: RuntimeStatus
  selectedModelId: ChatModelId
  cancelModelLoad: () => void
  clearChat: () => void
  continueLastResponse: () => void
  dismissError: () => void
  initModel: () => void
  retryLastTurn: () => void
  sendMessage: (value?: string) => void
  setComposer: (value: string) => void
  setSelectedModel: (modelId: ChatModelId) => void
  stopGeneration: () => void
}

type MutableChatState = Omit<
  ChatStoreState,
  | "cancelModelLoad"
  | "clearChat"
  | "continueLastResponse"
  | "dismissError"
  | "initModel"
  | "retryLastTurn"
  | "sendMessage"
  | "setComposer"
  | "setSelectedModel"
  | "stopGeneration"
>

type CreateChatStoreOptions = {
  deviceProfile?: DeviceProfile
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

const CONTINUE_PROMPT =
  "Continue your last response from where it stopped. Do not repeat prior text."

function createInitialLoadProgress(modelId: ChatModelId): ModelLoadProgress {
  return {
    phase: "Warm up",
    progress: 0,
    detail: `Fetching ${getModelConfig(modelId).label} tokenizer and model shards...`,
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

  const lastMessage = messages.at(-1)
  if (lastMessage?.id === activeAssistantId) {
    return [
      ...messages.slice(0, -1),
      {
        ...lastMessage,
        content: `${lastMessage.content}${chunk}`,
        state: "streaming",
      },
    ]
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
  finishReason?: FinishReason,
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

    return [{ ...message, finishReason, state: nextState }]
  })
}

function markAssistantMessageStreaming(
  messages: ChatMessage[],
  assistantId: string
): ChatMessage[] {
  return messages.map((message) =>
    message.id === assistantId
      ? { ...message, finishReason: undefined, state: "streaming" as const }
      : message
  )
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

type CompactionPayloadResult = {
  compactionDroppedChars: number
  compactionSummarizeMs: number
  modelMessages: ModelMessage[]
  rollingSummary: string
}

async function runRollingSummaryGeneration(
  runtime: ChatRuntime,
  modelId: ChatModelId,
  priorSummary: string,
  droppedMessages: ChatMessage[]
): Promise<{ ms: number; summary: string }> {
  if (droppedMessages.length === 0) {
    return { ms: 0, summary: priorSummary }
  }

  const transcript = serializeMessagesForSummary(droppedMessages)
  const summarizeMessages = buildCompactionSummarizeMessages(
    priorSummary,
    transcript
  )
  const requestId = `compact-${createId()}`
  const compactionGeneration = getModelConfig(modelId).compactionSummarize
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now()

  return new Promise((resolve) => {
    let buffer = ""
    const unsub = runtime.subscribe((event) => {
      if (event.requestId !== requestId) {
        return
      }

      if (event.type === "token") {
        buffer += event.text
        return
      }

      if (event.type === "complete") {
        unsub()
        const merged = buffer.trim() || priorSummary
        resolve({
          ms:
            (typeof performance !== "undefined"
              ? performance.now()
              : Date.now()) - startedAt,
          summary: clampCompactionSummary(merged),
        })
        return
      }

      if (event.type === "error") {
        unsub()
        resolve({
          ms:
            (typeof performance !== "undefined"
              ? performance.now()
              : Date.now()) - startedAt,
          summary: priorSummary,
        })
      }
    })

    runtime.generate(requestId, modelId, summarizeMessages, {
      generationOverrides: compactionGeneration,
    })
  })
}

async function buildCompactionPayloadForSend(args: {
  baseMessages: ChatMessage[]
  modelId: ChatModelId
  priorRollingSummary: string
  runtime: ChatRuntime
  userMessage: ChatMessage
}): Promise<CompactionPayloadResult> {
  const { baseMessages, modelId, priorRollingSummary, runtime, userMessage } =
    args

  const afterTurn = trimTurnWindow([...baseMessages, userMessage], modelId)
  const beforeTurn = trimTurnWindow(baseMessages, modelId)
  const afterIds = new Set(afterTurn.map((message) => message.id))

  const dropTurn = beforeTurn.filter((message) => !afterIds.has(message.id))

  const { droppedFromBudget } = trimToCharBudget(
    afterTurn,
    priorRollingSummary,
    modelId
  )

  const allDropped = mergeDroppedMessages(dropTurn, droppedFromBudget)
  const compactionDroppedChars = allDropped.reduce(
    (total, message) => total + message.content.length,
    0
  )

  const summarizeResult = await runRollingSummaryGeneration(
    runtime,
    modelId,
    priorRollingSummary,
    allDropped
  )

  const nextRolling = summarizeResult.summary

  const { budgetTrimmed } = trimToCharBudget(afterTurn, nextRolling, modelId)

  const systemMessage = buildSystemSummaryMessage(nextRolling)
  const core = chatMessagesToModelMessages(budgetTrimmed)

  const modelMessages = systemMessage ? [systemMessage, ...core] : core

  return {
    compactionDroppedChars,
    compactionSummarizeMs: summarizeResult.ms,
    modelMessages,
    rollingSummary: nextRolling,
  }
}

async function buildCompactionPayloadForRetry(args: {
  history: ChatMessage[]
  modelId: ChatModelId
  priorRollingSummary: string
  runtime: ChatRuntime
}): Promise<CompactionPayloadResult> {
  const { history, modelId, priorRollingSummary, runtime } = args

  const afterTurn = trimTurnWindow(history, modelId)

  const { droppedFromBudget } = trimToCharBudget(
    afterTurn,
    priorRollingSummary,
    modelId
  )

  const allDropped = mergeDroppedMessages([], droppedFromBudget)
  const compactionDroppedChars = allDropped.reduce(
    (total, message) => total + message.content.length,
    0
  )

  const summarizeResult = await runRollingSummaryGeneration(
    runtime,
    modelId,
    priorRollingSummary,
    allDropped
  )

  const nextRolling = summarizeResult.summary

  const { budgetTrimmed } = trimToCharBudget(afterTurn, nextRolling, modelId)

  const systemMessage = buildSystemSummaryMessage(nextRolling)
  const core = chatMessagesToModelMessages(budgetTrimmed)

  const modelMessages = systemMessage ? [systemMessage, ...core] : core

  return {
    compactionDroppedChars,
    compactionSummarizeMs: summarizeResult.ms,
    modelMessages,
    rollingSummary: nextRolling,
  }
}

async function buildCompactionPayloadForContinue(args: {
  messages: ChatMessage[]
  modelId: ChatModelId
  priorRollingSummary: string
  runtime: ChatRuntime
}): Promise<CompactionPayloadResult> {
  const { messages, modelId, priorRollingSummary, runtime } = args

  const continueTail: ModelMessage[] = [
    { role: "user", content: CONTINUE_PROMPT },
  ]

  const afterTurn = trimTurnWindow(messages, modelId)

  const { droppedFromBudget } = trimToCharBudget(
    afterTurn,
    priorRollingSummary,
    modelId,
    continueTail
  )

  const allDropped = mergeDroppedMessages([], droppedFromBudget)
  const compactionDroppedChars = allDropped.reduce(
    (total, message) => total + message.content.length,
    0
  )

  const summarizeResult = await runRollingSummaryGeneration(
    runtime,
    modelId,
    priorRollingSummary,
    allDropped
  )

  const nextRolling = summarizeResult.summary

  const { budgetTrimmed } = trimToCharBudget(
    afterTurn,
    nextRolling,
    modelId,
    continueTail
  )

  const systemMessage = buildSystemSummaryMessage(nextRolling)
  const core = chatMessagesToModelMessages(budgetTrimmed)

  const modelMessages = [
    ...(systemMessage ? [systemMessage] : []),
    ...core,
    ...continueTail,
  ]

  return {
    compactionDroppedChars,
    compactionSummarizeMs: summarizeResult.ms,
    modelMessages,
    rollingSummary: nextRolling,
  }
}

function getBusyStatus(hasLoadedModel: boolean): RuntimeStatus {
  return hasLoadedModel ? "generating" : "loading-model"
}

function getContinuableAssistantMessage(messages: ChatMessage[]) {
  const lastMessage = messages.at(-1)
  return lastMessage?.role === "assistant" && lastMessage.finishReason === "length"
    ? lastMessage
    : undefined
}

function createBaseState(
  deviceProfile: DeviceProfile = getDeviceProfile()
): MutableChatState {
  const selectedModelId = getRecommendedModelId(deviceProfile)

  return {
    activeAssistantId: null,
    activeDevice: null,
    activeRequestId: null,
    availableModels: getModelOptions(deviceProfile),
    composer: "",
    deviceProfile,
    error: null,
    hasLoadedModel: false,
    loadProgress: null,
    messages: [],
    pendingStop: false,
    rollingContextSummary: "",
    runtimeStatus: "idle",
    selectedModelId,
  }
}

function isModelSelectable(state: MutableChatState, modelId: ChatModelId) {
  return state.availableModels.some(
    (model) => model.id === modelId && model.disabled === false
  )
}

export function createChatStore(
  runtime: ChatRuntime,
  options: CreateChatStoreOptions = {}
) {
  const initialState = createBaseState(options.deviceProfile)

  return createStore<ChatStoreState>((set, get) => ({
    ...initialState,
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
        rollingContextSummary: "",
        runtimeStatus: state.hasLoadedModel ? "ready" : "idle",
      }))
    },
    continueLastResponse: () => {
      const state = get()
      if (
        state.runtimeStatus === "generating" ||
        state.runtimeStatus === "loading-model"
      ) {
        return
      }

      const targetMessage = getContinuableAssistantMessage(state.messages)
      if (!targetMessage) {
        return
      }

      const modelId = state.selectedModelId

      set({
        activeAssistantId: targetMessage.id,
        activeRequestId: targetMessage.id,
        error: null,
        messages: markAssistantMessageStreaming(
          state.messages,
          targetMessage.id
        ),
        pendingStop: false,
        runtimeStatus: getBusyStatus(state.hasLoadedModel),
      })

      void (async () => {
        const payload = await buildCompactionPayloadForContinue({
          messages: state.messages,
          modelId,
          priorRollingSummary: state.rollingContextSummary,
          runtime,
        })

        set({ rollingContextSummary: payload.rollingSummary })

        runtime.generate(targetMessage.id, modelId, payload.modelMessages, {
          compactionDroppedChars: payload.compactionDroppedChars,
          compactionSummarizeMs: payload.compactionSummarizeMs,
        })
      })()
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
        loadProgress:
          state.loadProgress ?? createInitialLoadProgress(state.selectedModelId),
        runtimeStatus: "loading-model",
      })
      runtime.init(state.selectedModelId)
    },
    cancelModelLoad: () => {
      const state = get()
      if (state.runtimeStatus !== "loading-model") {
        return
      }

      let nextMessages = state.messages
      let nextComposer = state.composer
      const last = state.messages.at(-1)
      const prev = state.messages.at(-2)
      if (
        last?.role === "assistant" &&
        last.state === "streaming" &&
        prev?.role === "user"
      ) {
        nextMessages = state.messages.slice(0, -2)
        nextComposer = prev.content
      }

      runtime.reset()
      runtime.recreateWorker()

      set({
        activeAssistantId: null,
        activeDevice: null,
        activeRequestId: null,
        composer: nextComposer,
        error: null,
        hasLoadedModel: false,
        loadProgress: null,
        messages: nextMessages,
        pendingStop: false,
        runtimeStatus: "idle",
      })
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
        loadProgress: state.hasLoadedModel
          ? state.loadProgress
          : (state.loadProgress ??
              createInitialLoadProgress(state.selectedModelId)),
        messages: [...history, assistantMessage],
        pendingStop: false,
        runtimeStatus: getBusyStatus(state.hasLoadedModel),
      })

      const modelId = state.selectedModelId

      void (async () => {
        const payload = await buildCompactionPayloadForRetry({
          history,
          modelId,
          priorRollingSummary: state.rollingContextSummary,
          runtime,
        })

        set({ rollingContextSummary: payload.rollingSummary })

        runtime.generate(assistantMessage.id, modelId, payload.modelMessages, {
          compactionDroppedChars: payload.compactionDroppedChars,
          compactionSummarizeMs: payload.compactionSummarizeMs,
        })
      })()
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

      const modelId = state.selectedModelId

      set({
        activeAssistantId: assistantMessage.id,
        activeRequestId: assistantMessage.id,
        composer: value === undefined ? "" : state.composer,
        error: null,
        loadProgress: state.hasLoadedModel
          ? state.loadProgress
          : (state.loadProgress ??
              createInitialLoadProgress(state.selectedModelId)),
        messages: nextMessages,
        pendingStop: false,
        runtimeStatus: getBusyStatus(state.hasLoadedModel),
      })

      void (async () => {
        const payload = await buildCompactionPayloadForSend({
          baseMessages,
          modelId,
          priorRollingSummary: state.rollingContextSummary,
          runtime,
          userMessage,
        })

        set({ rollingContextSummary: payload.rollingSummary })

        runtime.generate(assistantMessage.id, modelId, payload.modelMessages, {
          compactionDroppedChars: payload.compactionDroppedChars,
          compactionSummarizeMs: payload.compactionSummarizeMs,
        })
      })()
    },
    setComposer: (value) => {
      set({ composer: value })
    },
    setSelectedModel: (modelId) => {
      const state = get()
      if (
        state.selectedModelId === modelId ||
        !isModelSelectable(state, modelId)
      ) {
        return
      }

      if (state.runtimeStatus === "generating") {
        runtime.stop()
      }

      runtime.reset()
      runtime.recreateWorker()

      set((currentState) => ({
        ...currentState,
        activeAssistantId: null,
        activeDevice: null,
        activeRequestId: null,
        composer: "",
        error: null,
        hasLoadedModel: false,
        loadProgress: null,
        messages: [],
        pendingStop: false,
        rollingContextSummary: "",
        runtimeStatus: "idle",
        selectedModelId: modelId,
      }))
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

function eventTargetsSelectedModel(
  state: ChatStoreState,
  event: WorkerEvent
): boolean {
  return event.modelId === undefined || event.modelId === state.selectedModelId
}

export function applyWorkerEvent(
  store: StoreApi<ChatStoreState>,
  event: WorkerEvent
) {
  switch (event.type) {
    case "progress": {
      store.setState((state) => {
        if (!eventTargetsSelectedModel(state, event)) {
          return state
        }

        return {
          error: null,
          loadProgress: event.progress,
          runtimeStatus: "loading-model" as const,
        }
      })
      return
    }

    case "ready": {
      store.setState((state) => {
        if (!eventTargetsSelectedModel(state, event)) {
          return state
        }

        const model = getModelConfig(event.modelId)

        return {
          activeDevice: event.device,
          error: null,
          hasLoadedModel: true,
          loadProgress: {
            phase: "Ready",
            progress: 100,
            detail: `${model.label} is loaded on ${event.device.toUpperCase()}.`,
          },
          runtimeStatus: state.activeAssistantId ? "generating" : "ready",
        }
      })
      return
    }

    case "token": {
      store.setState((state) => {
        if (
          !eventTargetsSelectedModel(state, event) ||
          (state.activeRequestId !== null &&
            state.activeRequestId !== event.requestId)
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
          !eventTargetsSelectedModel(state, event) ||
          (state.activeRequestId !== null &&
            state.activeRequestId !== event.requestId)
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
            event.finishReason,
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
        if (!eventTargetsSelectedModel(state, event)) {
          return state
        }

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
