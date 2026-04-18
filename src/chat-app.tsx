import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { PaperPlaneTiltIcon, StopIcon } from "@phosphor-icons/react"

import { ChatEmptyState } from "@/components/chat/chat-empty-state"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble"
import { ChatPerfOverlay } from "@/components/chat/chat-perf-overlay"
import { ChatPrepareModel } from "@/components/chat/chat-prepare-model"
import { ScrollToBottomButton } from "@/components/chat/scroll-to-bottom-button"
import { copyToClipboard } from "@/components/chat/chat-ui"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatBytes, getModelConfig } from "@/lib/chat-config"
import {
  getLatestChatPerfSample,
  subscribeChatPerf,
} from "@/lib/chat-runtime"
import { useChatStore } from "@/lib/chat-store"
import type { ChatMessage } from "@/lib/chat-types"

export function ChatApp() {
  const messages = useChatStore((state) => state.messages)
  const composer = useChatStore((state) => state.composer)
  const runtimeStatus = useChatStore((state) => state.runtimeStatus)
  const error = useChatStore((state) => state.error)
  const hasLoadedModel = useChatStore((state) => state.hasLoadedModel)
  const loadProgress = useChatStore((state) => state.loadProgress)
  const availableModels = useChatStore((state) => state.availableModels)
  const selectedModelId = useChatStore((state) => state.selectedModelId)
  const deviceProfile = useChatStore((state) => state.deviceProfile)
  const setComposer = useChatStore((state) => state.setComposer)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const continueLastResponse = useChatStore(
    (state) => state.continueLastResponse
  )
  const initModel = useChatStore((state) => state.initModel)
  const cancelModelLoad = useChatStore((state) => state.cancelModelLoad)
  const stopGeneration = useChatStore((state) => state.stopGeneration)
  const retryLastTurn = useChatStore((state) => state.retryLastTurn)
  const clearChat = useChatStore((state) => state.clearChat)
  const dismissError = useChatStore((state) => state.dismissError)
  const setSelectedModel = useChatStore((state) => state.setSelectedModel)
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const isNearBottomRef = useRef(true)
  const copyFeedbackTimeoutRef = useRef<number | null>(null)
  const previousMessageCountRef = useRef(0)
  const previousLastMessageIdRef = useRef<string | null>(null)
  const previousLastMessageLengthRef = useRef(0)
  const [copiedMessageState, setCopiedMessageState] = useState<{
    messageId: string
    status: "copied" | "error"
  } | null>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const perfSample = useSyncExternalStore(
    subscribeChatPerf,
    getLatestChatPerfSample,
    () => null
  )

  const selectedModel = getModelConfig(selectedModelId)
  const busy =
    runtimeStatus === "generating" || runtimeStatus === "loading-model"
  const canRetry =
    !busy &&
    messages.some((message) => message.role === "user") &&
    messages.at(-1)?.role !== "user"
  const canSend = composer.trim().length > 0 && !busy
  const shouldShowScrollToBottom = showScrollToBottom && !isNearBottom
  const continuableMessageId =
    messages.at(-1)?.role === "assistant" &&
    messages.at(-1)?.finishReason === "length"
      ? messages.at(-1)?.id ?? null
      : null
  const showPrepareModel = !hasLoadedModel
  const shouldVirtualize = messages.length > 80
  const mascotTone = error
    ? "error"
    : runtimeStatus === "loading-model"
      ? "loading"
      : runtimeStatus === "generating"
        ? "typing"
        : runtimeStatus === "ready"
          ? "ready"
          : "idle"
  const progressMeta = !loadProgress
    ? null
    : (() => {
        const loaded = formatBytes(loadProgress.loaded)
        const total = formatBytes(loadProgress.total)

        return loaded && total ? `${loaded} / ${total}` : null
      })()

  const scrollButtonOffsetClassName = showPrepareModel
    ? "bottom-[calc(10rem+env(safe-area-inset-bottom))] sm:bottom-[calc(9rem+env(safe-area-inset-bottom))]"
    : "bottom-[calc(6.75rem+env(safe-area-inset-bottom))] sm:bottom-[calc(6.25rem+env(safe-area-inset-bottom))]"
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? messages.length : 0,
    estimateSize: () => 156,
    gap: 12,
    getScrollElement: () => scrollViewportRef.current,
    overscan: 6,
    paddingEnd: 16,
    paddingStart: 16,
  })
  const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) {
      return
    }

    const updateScrollState = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      const nextIsNearBottom = distanceFromBottom < 56

      isNearBottomRef.current = nextIsNearBottom
      setIsNearBottom(nextIsNearBottom)
      setShowScrollToBottom(messages.length > 0 && !nextIsNearBottom)
    }

    updateScrollState()
    viewport.addEventListener("scroll", updateScrollState, { passive: true })

    return () => {
      viewport.removeEventListener("scroll", updateScrollState)
    }
  }, [messages.length])

  useEffect(() => {
    if (!shouldVirtualize) {
      return
    }

    rowVirtualizer.measure()
  }, [messages, rowVirtualizer, shouldVirtualize])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    const lastMessage = messages.at(-1)

    if (!viewport) {
      return
    }

    const isNewMessage =
      previousMessageCountRef.current !== messages.length ||
      previousLastMessageIdRef.current !== (lastMessage?.id ?? null)
    const lastMessageLength = lastMessage?.content.length ?? 0
    const isStreamingUpdate =
      previousLastMessageLengthRef.current !== lastMessageLength

    const rafId = window.requestAnimationFrame(() => {
      if (isNearBottomRef.current && (isNewMessage || isStreamingUpdate)) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: isNewMessage ? "smooth" : "auto",
        })
      }

      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      const nextIsNearBottom = distanceFromBottom < 56

      isNearBottomRef.current = nextIsNearBottom
      setIsNearBottom(nextIsNearBottom)
      setShowScrollToBottom(messages.length > 0 && !nextIsNearBottom)

      previousMessageCountRef.current = messages.length
      previousLastMessageIdRef.current = lastMessage?.id ?? null
      previousLastMessageLengthRef.current = lastMessageLength
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [messages])

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollViewportRef.current
    if (!viewport) {
      return
    }

    isNearBottomRef.current = true
    setIsNearBottom(true)
    setShowScrollToBottom(false)
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    })
  }

  const handleCopyMessage = async (message: ChatMessage) => {
    if (message.content.trim().length === 0) {
      return
    }

    try {
      await copyToClipboard(message.content)
      setCopiedMessageState({ messageId: message.id, status: "copied" })
    } catch {
      setCopiedMessageState({ messageId: message.id, status: "error" })
    }

    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current)
    }

    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopiedMessageState((current) =>
        current?.messageId === message.id ? null : current
      )
    }, 1800)
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      {import.meta.env.DEV ? <ChatPerfOverlay sample={perfSample} /> : null}
      <ChatHeader
        availableModels={availableModels}
        canRetry={canRetry}
        mascotTone={mascotTone}
        messagesCount={messages.length}
        onClear={clearChat}
        onRetry={retryLastTurn}
        onSelectModel={setSelectedModel}
        selectedModelId={selectedModelId}
        selectedModelLabel={selectedModel.label}
      />

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 pt-16 sm:px-4">
        <div
          ref={scrollViewportRef}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${
            showPrepareModel
              ? "pb-[calc(12rem+env(safe-area-inset-bottom))]"
              : "pb-[calc(8.5rem+env(safe-area-inset-bottom))]"
          }`}
        >
          {messages.length === 0 ? (
            <ChatEmptyState
              busy={busy}
              currentModelLabel={selectedModel.label}
              onPrompt={sendMessage}
            />
          ) : shouldVirtualize ? (
            <div
              className="relative"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualRows.map((virtualRow) => {
                const message = messages[virtualRow.index]
                if (!message) {
                  return null
                }

                return (
                  <div
                    data-index={virtualRow.index}
                    key={message.id}
                    ref={(node) => {
                      if (node) {
                        rowVirtualizer.measureElement(node)
                      }
                    }}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ChatMessageBubble
                      canContinue={
                        !busy &&
                        continuableMessageId === message.id &&
                        message.content.trim().length > 0
                      }
                      copyState={
                        copiedMessageState?.messageId === message.id
                          ? copiedMessageState.status
                          : null
                      }
                      message={message}
                      onContinue={continueLastResponse}
                      onCopy={handleCopyMessage}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-4">
              {messages.map((message) => (
                <ChatMessageBubble
                  canContinue={
                    !busy &&
                    continuableMessageId === message.id &&
                    message.content.trim().length > 0
                  }
                  key={message.id}
                  copyState={
                    copiedMessageState?.messageId === message.id
                      ? copiedMessageState.status
                      : null
                  }
                  message={message}
                  onContinue={continueLastResponse}
                  onCopy={handleCopyMessage}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <ScrollToBottomButton
        offsetClassName={scrollButtonOffsetClassName}
        visible={shouldShowScrollToBottom}
        onScrollToBottom={() => scrollToBottom()}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          {showPrepareModel ? (
            <ChatPrepareModel
              detail={
                loadProgress?.detail ??
                `Ready to prepare ${selectedModel.label}.`
              }
              deviceProfile={deviceProfile}
              error={error}
              modelLabel={selectedModel.label}
              onCancelModelLoad={cancelModelLoad}
              onDismissError={dismissError}
              onInitModel={initModel}
              progress={loadProgress?.progress ?? null}
              progressMeta={progressMeta}
              runtimeStatus={runtimeStatus}
            />
          ) : null}
          <div className="border border-border bg-card p-2 shadow-[0_-10px_28px_rgba(0,0,0,0.22)]">
            <div className="flex items-end gap-2">
              <Textarea
                className="max-h-36 min-h-12 resize-none border-border bg-transparent px-4 py-3 text-sm leading-6 focus-visible:ring-0"
                placeholder="Message Bumblebee"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) {
                    return
                  }

                  event.preventDefault()
                  sendMessage()
                }}
              />

              <div className="flex shrink-0 items-center gap-2 pb-1">
                <Button
                  disabled={runtimeStatus !== "generating"}
                  size="icon"
                  variant="secondary"
                  onClick={stopGeneration}
                >
                  <StopIcon />
                </Button>
                <Button
                  disabled={!canSend}
                  size="icon"
                  onClick={() => sendMessage()}
                >
                  <PaperPlaneTiltIcon />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatApp
