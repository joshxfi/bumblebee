import { useEffect, useMemo, useRef, type ComponentProps } from "react"
import {
  ArrowClockwise,
  ArrowUpRight,
  Cpu,
  Lightning,
  PaperPlaneTilt,
  Stop,
  TrashSimple,
  Warning,
} from "@phosphor-icons/react"

import { CHAT_MODEL_CONFIG, formatBytes } from "@/lib/chat-config"
import { useChatStore } from "@/lib/chat-store"
import type { ChatMessage, RuntimeStatus } from "@/lib/chat-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
            className="border-white/10 bg-card text-foreground hover:bg-accent"
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
  onPrompt,
}: {
  busy: boolean
  onPrompt: (prompt: string) => void
}) {
  return (
    <div className="flex min-h-full flex-col justify-center px-4 py-12">
      <div className="max-w-md space-y-3">
        <Badge
          className="border-primary/25 bg-primary/10 text-primary"
          variant="outline"
        >
          On-device and ephemeral
        </Badge>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Start chatting with Bumblebee
        </h1>
        <p className="text-sm/6 text-muted-foreground">
          Everything stays in this tab. Pick a starter or type your own message.
        </p>
      </div>

      <div className="mt-8 flex max-w-xl flex-col gap-2">
        {starterPrompts.map((prompt) => (
          <Button
            key={prompt}
            className="justify-start border-white/10 bg-card px-4 py-5 text-left text-foreground hover:bg-accent"
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const assistant = message.role === "assistant"

  return (
    <article
      className={`flex flex-col gap-1 ${
        assistant ? "items-start" : "items-end"
      }`}
    >
      <div
        className={`max-w-[86%] border px-4 py-3 text-sm/6 shadow-[0_6px_18px_rgba(0,0,0,0.16)] sm:max-w-[72%] ${
          assistant
            ? "border-white/10 bg-card text-foreground"
            : "border-primary bg-primary text-primary-foreground"
        }`}
      >
        {message.content || (
          <span className="text-muted-foreground">
            {message.state === "error"
              ? "Response failed before any text arrived."
              : " "}
          </span>
        )}
        {message.state === "streaming" ? (
          <span className="ml-1 inline-flex size-2 animate-pulse bg-current align-middle opacity-80" />
        ) : null}
      </div>
      <div className="px-1 text-[11px] text-muted-foreground">
        {assistant ? "Bumblebee" : "You"} · {formatTimestamp(message.createdAt)}
      </div>
    </article>
  )
}

function ComposerStatus({
  detail,
  error,
  hasLoadedModel,
  onDismissError,
  onInitModel,
  progress,
  progressMeta,
  runtimeStatus,
}: {
  detail: string
  error: string | null
  hasLoadedModel: boolean
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
        </div>
        <Button size="sm" variant="outline" onClick={onDismissError}>
          Dismiss
        </Button>
      </div>
    )
  }

  if (runtimeStatus === "loading-model") {
    return (
      <div className="border border-white/10 bg-card px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Lightning className="shrink-0 text-primary" />
            <span className="truncate text-foreground">{detail}</span>
          </div>
          <Badge variant="secondary">Loading</Badge>
        </div>
        <Progress value={progress ?? 8}>
          <ProgressLabel>Bumblebee warmup</ProgressLabel>
          <ProgressValue>
            {() => (progress === null ? "Preparing" : `${progress}%`)}
          </ProgressValue>
        </Progress>
        {progressMeta ? (
          <div className="mt-2 text-xs text-muted-foreground">
            {progressMeta}
          </div>
        ) : null}
      </div>
    )
  }

  if (!hasLoadedModel) {
    return (
      <div className="flex items-center justify-between gap-3 border border-white/10 bg-card px-3 py-3 text-sm">
        <div className="min-w-0">
          <div className="text-foreground">Model not loaded yet</div>
          <div className="text-muted-foreground">
            First use downloads Bumblebee into browser cache.
          </div>
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
  const setComposer = useChatStore((state) => state.setComposer)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const initModel = useChatStore((state) => state.initModel)
  const stopGeneration = useChatStore((state) => state.stopGeneration)
  const retryLastTurn = useChatStore((state) => state.retryLastTurn)
  const clearChat = useChatStore((state) => state.clearChat)
  const dismissError = useChatStore((state) => state.dismissError)
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const previousMessageCountRef = useRef(0)
  const previousLastMessageIdRef = useRef<string | null>(null)
  const previousLastMessageLengthRef = useRef(0)

  const busy =
    runtimeStatus === "generating" || runtimeStatus === "loading-model"
  const canRetry =
    !busy &&
    messages.some((message) => message.role === "user") &&
    messages.at(-1)?.role !== "user"
  const canSend = composer.trim().length > 0 && !busy
  const showHeaderChip = hasLoadedModel && !error
  const headerChipLabel = [
    CHAT_MODEL_CONFIG.label,
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
    const viewport = scrollViewportRef.current
    if (!viewport) {
      return
    }

    const handleScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      stickToBottomRef.current = distanceFromBottom < 48
    }

    handleScroll()
    viewport.addEventListener("scroll", handleScroll)

    return () => {
      viewport.removeEventListener("scroll", handleScroll)
    }
  }, [])

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
      if (stickToBottomRef.current && (isNewMessage || isStreamingUpdate)) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: isNewMessage ? "smooth" : "auto",
        })
      }

      previousMessageCountRef.current = messages.length
      previousLastMessageIdRef.current = lastMessage?.id ?? null
      previousLastMessageLengthRef.current = lastMessageLength
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [messages])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-3 sm:px-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              Bumblebee
            </div>
            <div className="truncate text-xs text-muted-foreground">
              On-device chat
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showHeaderChip ? (
              <Badge
                className="hidden border-primary/25 bg-primary/10 text-primary sm:inline-flex"
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

      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-3 pt-16 sm:px-4">
        <div
          ref={scrollViewportRef}
          className="flex-1 overflow-y-auto overscroll-contain pb-[calc(11rem+env(safe-area-inset-bottom))]"
        >
          {messages.length === 0 ? (
            <EmptyState busy={busy} onPrompt={sendMessage} />
          ) : (
            <div className="flex flex-col gap-3 py-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          <ComposerStatus
            detail={
              pendingStop
                ? "Stopping generation..."
                : (loadProgress?.detail ?? "Ready to start a conversation.")
            }
            error={error}
            hasLoadedModel={hasLoadedModel}
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

          <div className="border border-white/10 bg-card p-2 shadow-[0_-10px_28px_rgba(0,0,0,0.22)]">
            <div className="flex items-end gap-2">
              <Textarea
                className="max-h-36 min-h-12 resize-none border-white/10 bg-transparent px-4 py-3 text-sm leading-6 focus-visible:ring-0"
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
