import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUpRight,
  Check,
  CopySimple,
  Cpu,
  Lightning,
  PaperPlaneTilt,
  Stop,
  TrashSimple,
  Warning,
} from "@phosphor-icons/react"

import { MarkdownMessage } from "@/components/markdown-message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatBytes, getModelConfig } from "@/lib/chat-config"
import { useChatStore } from "@/lib/chat-store"
import type { ChatMessage, ChatModelId, RuntimeStatus } from "@/lib/chat-types"

const starterPrompts = [
  "Tell me a short joke.",
  "Give me three weekend ideas.",
  "Help me write a friendly text reply.",
  "Suggest a quick dinner idea.",
]

const statusTone: Record<
  RuntimeStatus,
  {
    label: string
    variant: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  idle: { label: "Cold", variant: "outline" },
  "loading-model": { label: "Loading", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  generating: { label: "Typing", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "absolute"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand("copy")
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error("Copy failed.")
  }
}

function HeaderAction({
  label,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="border-border bg-card text-foreground hover:bg-accent"
            size="icon-sm"
            variant="outline"
            {...props}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

function EmptyState({
  busy,
  currentModelLabel,
  onPrompt,
}: {
  busy: boolean
  currentModelLabel: string
  onPrompt: (prompt: string) => void
}) {
  return (
    <div className="flex min-h-full flex-col justify-center px-4 py-12">
      <div className="max-w-md space-y-3">
        <Badge
          className="border-primary/25 bg-primary/10 text-primary"
          variant="outline"
        >
          {currentModelLabel} · On-device
        </Badge>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Start chatting with Bumblebee
        </h1>
        <p className="text-sm/6 text-muted-foreground">
          Everything stays in this tab. Pick a starter or type your own
          message.
        </p>
      </div>

      <div className="mt-8 flex max-w-xl flex-col gap-2">
        {starterPrompts.map((prompt) => (
          <Button
            key={prompt}
            className="justify-start border-border bg-card px-4 py-5 text-left text-foreground hover:bg-accent"
            disabled={busy}
            variant="outline"
            onClick={() => onPrompt(prompt)}
          >
            <ArrowUpRight data-icon="inline-start" />
            <span className="truncate">{prompt}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({
  copyState,
  message,
  onCopy,
}: {
  copyState: "copied" | "error" | null
  message: ChatMessage
  onCopy: (message: ChatMessage) => void
}) {
  const assistant = message.role === "assistant"
  const fallbackContent =
    message.content ||
    (message.state === "error" ? "Response failed before any text arrived." : "")
  const canCopy = assistant && message.content.trim().length > 0

  return (
    <article
      className={`flex flex-col gap-1 ${
        assistant ? "items-start" : "items-end"
      }`}
    >
      <div
        className={`max-w-[88%] border px-4 py-3 text-sm/6 shadow-[0_6px_18px_rgba(0,0,0,0.16)] sm:max-w-[72%] ${
          assistant
            ? "border-border bg-card text-foreground"
            : "border-primary bg-primary text-primary-foreground"
        }`}
      >
        <MarkdownMessage
          className={`bumblebee-markdown ${
            assistant
              ? "text-foreground"
              : "text-primary-foreground [--link-color:var(--primary-foreground)]"
          }`}
          content={fallbackContent}
          streaming={message.state === "streaming"}
        />
        {message.state === "streaming" ? (
          <span className="mt-2 inline-flex size-2 animate-pulse bg-current align-middle opacity-80" />
        ) : null}
      </div>
      <div
        className={`flex w-full items-center gap-2 px-1 text-[11px] text-muted-foreground ${
          assistant ? "justify-between" : "justify-end"
        }`}
      >
        <span>
          {assistant ? "Bumblebee" : "You"} · {formatTimestamp(message.createdAt)}
        </span>
        {canCopy ? (
          <div className="flex items-center gap-2">
            {copyState ? (
              <span
                className={
                  copyState === "error" ? "text-destructive" : "text-primary"
                }
              >
                {copyState === "copied" ? "Copied" : "Copy failed"}
              </span>
            ) : null}
            <Button
              aria-label="Copy response"
              className="px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              size="xs"
              variant="ghost"
              onClick={() => onCopy(message)}
            >
              {copyState === "copied" ? <Check /> : <CopySimple />}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function ComposerStatus({
  detail,
  deviceProfile,
  error,
  hasLoadedModel,
  modelLabel,
  onDismissError,
  onInitModel,
  progress,
  progressMeta,
  runtimeStatus,
}: {
  detail: string
  deviceProfile: "constrained" | "standard"
  error: string | null
  hasLoadedModel: boolean
  modelLabel: string
  onDismissError: () => void
  onInitModel: () => void
  progress: number | null
  progressMeta: string | null
  runtimeStatus: RuntimeStatus
}) {
  if (error) {
    return (
      <div className="flex items-start gap-3 border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm">
        <Warning className="mt-0.5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">Runtime issue</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
          {deviceProfile === "constrained" && !hasLoadedModel ? (
            <div className="mt-1 text-muted-foreground">
              This device is using the lighter model for stability. If the tab
              reloads again, close other apps or tabs and retry.
            </div>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={onDismissError}>
          Dismiss
        </Button>
      </div>
    )
  }

  if (runtimeStatus === "loading-model") {
    return (
      <div className="border border-border bg-card px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Lightning className="shrink-0 text-primary" />
            <span className="truncate text-foreground">{detail}</span>
          </div>
          <Badge variant="secondary">Loading</Badge>
        </div>
        <Progress value={progress ?? 8}>
          <ProgressLabel>{modelLabel} warmup</ProgressLabel>
          <ProgressValue>
            {() => (progress === null ? "Preparing" : `${progress}%`)}
          </ProgressValue>
        </Progress>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {progressMeta ? <span>{progressMeta}</span> : null}
          {deviceProfile === "constrained" ? (
            <span>Mobile-safe model selected for this device.</span>
          ) : null}
        </div>
      </div>
    )
  }

  if (!hasLoadedModel) {
    return (
      <div className="flex items-center justify-between gap-3 border border-border bg-card px-3 py-3 text-sm">
        <div className="min-w-0">
          <div className="text-foreground">{modelLabel} is not loaded yet</div>
          <div className="text-muted-foreground">
            First use downloads this model into browser cache.
          </div>
          {deviceProfile === "constrained" ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Bumblebee picked the lighter model for this device to reduce
              Safari crashes.
            </div>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={onInitModel}>
          <Cpu data-icon="inline-start" />
          Load
        </Button>
      </div>
    )
  }

  return null
}

export function App() {
  const messages = useChatStore((state) => state.messages)
  const composer = useChatStore((state) => state.composer)
  const runtimeStatus = useChatStore((state) => state.runtimeStatus)
  const loadProgress = useChatStore((state) => state.loadProgress)
  const error = useChatStore((state) => state.error)
  const pendingStop = useChatStore((state) => state.pendingStop)
  const hasLoadedModel = useChatStore((state) => state.hasLoadedModel)
  const activeDevice = useChatStore((state) => state.activeDevice)
  const availableModels = useChatStore((state) => state.availableModels)
  const selectedModelId = useChatStore((state) => state.selectedModelId)
  const deviceProfile = useChatStore((state) => state.deviceProfile)
  const setComposer = useChatStore((state) => state.setComposer)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const initModel = useChatStore((state) => state.initModel)
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

  const selectedModel = getModelConfig(selectedModelId)
  const busy =
    runtimeStatus === "generating" || runtimeStatus === "loading-model"
  const canRetry =
    !busy &&
    messages.some((message) => message.role === "user") &&
    messages.at(-1)?.role !== "user"
  const canSend = composer.trim().length > 0 && !busy
  const showHeaderChip = hasLoadedModel && !error
  const showComposerStatus =
    Boolean(error) || runtimeStatus === "loading-model" || !hasLoadedModel
  const shouldShowScrollToBottom = showScrollToBottom && !isNearBottom
  const headerChipLabel = [
    selectedModel.shortLabel,
    activeDevice?.toUpperCase(),
    runtimeStatus === "generating" ? statusTone.generating.label : undefined,
  ]
    .filter(Boolean)
    .join(" · ")

  const progressMeta = useMemo(() => {
    if (!loadProgress) {
      return null
    }

    const loaded = formatBytes(loadProgress.loaded)
    const total = formatBytes(loadProgress.total)

    return loaded && total ? `${loaded} / ${total}` : null
  }, [loadProgress])

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
    viewport.addEventListener("scroll", updateScrollState)

    return () => {
      viewport.removeEventListener("scroll", updateScrollState)
    }
  }, [messages.length])

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
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-2 px-3 sm:px-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              Bumblebee
            </div>
            <div className="truncate text-xs text-muted-foreground">
              On-device chat
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={selectedModelId}
              onValueChange={(value) =>
                setSelectedModel(value as ChatModelId)
              }
            >
              <SelectTrigger
                aria-label="Select model"
                className="w-[8.75rem] border-border bg-card text-foreground hover:bg-accent sm:w-[11rem]"
                size="sm"
              >
                <span className="truncate">{selectedModel.label}</span>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-64 sm:min-w-72">
                <SelectGroup>
                  {availableModels.map((model) => (
                    <SelectItem
                      key={model.id}
                      className="items-start py-2.5"
                      disabled={model.disabled}
                      value={model.id}
                    >
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal">
                        <span className="leading-4 font-medium text-foreground">
                          {model.label}
                        </span>
                        <span className="text-[11px] leading-4 text-muted-foreground">
                          {model.disabled
                            ? "Desktop recommended"
                            : model.description}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {showHeaderChip ? (
              <Badge
                className="hidden shrink-0 border-primary/25 bg-primary/10 text-primary sm:inline-flex"
                variant="outline"
              >
                {headerChipLabel}
              </Badge>
            ) : null}
            <HeaderAction
              disabled={!canRetry}
              label="Retry last response"
              onClick={retryLastTurn}
            >
              <ArrowClockwise />
            </HeaderAction>
            <HeaderAction
              disabled={messages.length === 0}
              label="Clear conversation"
              onClick={clearChat}
            >
              <TrashSimple />
            </HeaderAction>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 pt-16 sm:px-4">
        <div
          ref={scrollViewportRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(12rem+env(safe-area-inset-bottom))]"
        >
          {messages.length === 0 ? (
            <EmptyState
              busy={busy}
              currentModelLabel={selectedModel.label}
              onPrompt={sendMessage}
            />
          ) : (
            <div className="flex flex-col gap-3 py-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  copyState={
                    copiedMessageState?.messageId === message.id
                      ? copiedMessageState.status
                      : null
                  }
                  message={message}
                  onCopy={handleCopyMessage}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {shouldShowScrollToBottom ? (
        <div
          className={`pointer-events-none fixed inset-x-0 z-20 ${
            showComposerStatus
              ? "bottom-[calc(11rem+env(safe-area-inset-bottom))] sm:bottom-[calc(9.5rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(6.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
          }`}
        >
          <div className="mx-auto flex w-full max-w-3xl justify-end px-3 sm:px-4">
            <Button
              aria-label="Scroll to latest messages"
              className="pointer-events-auto border border-border shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
              size="icon-sm"
              variant="secondary"
              onClick={() => scrollToBottom()}
            >
              <ArrowDown />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          <ComposerStatus
            detail={
              pendingStop
                ? "Stopping generation..."
                : (loadProgress?.detail ??
                    `Ready to chat with ${selectedModel.label}.`)
            }
            deviceProfile={deviceProfile}
            error={error}
            hasLoadedModel={hasLoadedModel}
            modelLabel={selectedModel.label}
            onDismissError={dismissError}
            onInitModel={initModel}
            progress={loadProgress?.progress ?? null}
            progressMeta={progressMeta}
            runtimeStatus={runtimeStatus}
          />

          {showHeaderChip ? (
            <Badge
              className="w-fit border-primary/25 bg-primary/10 text-primary sm:hidden"
              variant="outline"
            >
              {headerChipLabel}
            </Badge>
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
                  <Stop />
                </Button>
                <Button
                  disabled={!canSend}
                  size="icon"
                  onClick={() => sendMessage()}
                >
                  <PaperPlaneTilt />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
