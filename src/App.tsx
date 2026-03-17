import { useEffect, useMemo, useRef } from "react"
import {
  ArrowClockwise,
  ArrowUpRight,
  Cpu,
  Lightning,
  PaperPlaneTilt,
  Sparkle,
  Stop,
  TrashSimple,
  Warning,
} from "@phosphor-icons/react"

import { CHAT_COPY, CHAT_MODEL_CONFIG, formatBytes } from "@/lib/chat-config"
import { useChatStore } from "@/lib/chat-store"
import type { ChatMessage, RuntimeStatus } from "@/lib/chat-types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const starterPrompts = [
  "Explain what makes small language models practical in the browser.",
  "Draft a three-bullet summary of WebGPU vs WASM for mobile inference.",
  "Write a friendly onboarding blurb for an ephemeral chat app.",
]

const statusTone: Record<
  RuntimeStatus,
  {
    label: string
    variant: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  idle: { label: "Cold start", variant: "outline" },
  "loading-model": { label: "Loading model", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  generating: { label: "Generating", variant: "secondary" },
  error: { label: "Needs attention", variant: "destructive" },
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            size="icon-sm"
            variant="outline"
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
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

function getMessageLabel(message: ChatMessage) {
  return message.role === "assistant" ? "Local model" : "You"
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
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  const busy =
    runtimeStatus === "generating" || runtimeStatus === "loading-model"
  const canRetry =
    !busy &&
    messages.some((message) => message.role === "user") &&
    messages.at(-1)?.role !== "user"
  const currentStatus = statusTone[runtimeStatus]
  const progressMeta = useMemo(() => {
    if (!loadProgress) {
      return null
    }

    const loaded = formatBytes(loadProgress.loaded)
    const total = formatBytes(loadProgress.total)

    return loaded && total ? `${loaded} / ${total}` : null
  }, [loadProgress])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    })
  }, [messages])

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(167,217,178,0.4),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(88,113,92,0.18),transparent_24%),linear-gradient(180deg,rgba(255,252,246,0.98),rgba(246,241,233,0.94))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-foreground/10" />

      <main className="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.95fr)]">
        <section className="flex min-w-0 flex-col gap-4">
          <Card className="border border-foreground/10 bg-card/88 backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge variant="outline">Ephemeral transcript</Badge>
                    <Badge variant="outline">Client-only runtime</Badge>
                    <Badge variant="secondary">
                      {activeDevice === "webgpu"
                        ? "WebGPU active"
                        : "WASM baseline"}
                    </Badge>
                  </div>
                  <CardTitle className="[font-family:var(--font-display)] text-3xl leading-none sm:text-4xl">
                    Pocket Relay
                  </CardTitle>
                  <CardDescription className="mt-3 max-w-2xl text-xs/relaxed text-muted-foreground sm:text-sm/relaxed">
                    {CHAT_COPY.subtitle}
                  </CardDescription>
                </div>
                <Badge variant={currentStatus.variant}>
                  {currentStatus.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 md:grid-cols-[minmax(0,1.2fr)_minmax(13rem,0.8fr)]">
              <div className="grid gap-3 text-xs/relaxed text-muted-foreground sm:text-sm/relaxed">
                <p>
                  A small browser model with no server memory. Refresh the page
                  and the conversation is gone.
                </p>
                <p>{CHAT_COPY.warmup}</p>
              </div>
              <div className="grid gap-3 border border-border/70 bg-background/75 p-3">
                <div className="flex items-center gap-2 text-xs tracking-[0.22em] text-muted-foreground uppercase">
                  <Sparkle />
                  Runtime profile
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-medium">
                      {CHAT_MODEL_CONFIG.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Quantization</span>
                    <span className="font-medium uppercase">
                      {CHAT_MODEL_CONFIG.dtype}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">Current tab only</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-[28rem] flex-1 border border-foreground/10 bg-card/92 backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Conversation</CardTitle>
                  <CardDescription>
                    Streaming responses from the browser worker.
                  </CardDescription>
                </div>
                <CardAction className="flex items-center gap-2">
                  <IconButton
                    disabled={!canRetry}
                    label="Retry the last assistant turn"
                    onClick={retryLastTurn}
                  >
                    <ArrowClockwise />
                  </IconButton>
                  <IconButton
                    disabled={messages.length === 0}
                    label="Clear the current conversation"
                    onClick={clearChat}
                  >
                    <TrashSimple />
                  </IconButton>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col pt-4">
              <ScrollArea className="min-h-[19rem] flex-1 pr-2">
                <div className="flex flex-col gap-4 pb-2">
                  {messages.length === 0 ? (
                    <div className="grid gap-5 border border-dashed border-border bg-background/70 p-4 sm:p-5">
                      <div className="grid gap-2">
                        <div className="flex items-center gap-2 text-xs tracking-[0.24em] text-muted-foreground uppercase">
                          <Lightning />
                          Quick start
                        </div>
                        <p className="max-w-xl text-sm/relaxed text-muted-foreground">
                          Try a short prompt first. Smaller local models respond
                          fastest when the request is direct and scoped.
                        </p>
                      </div>
                      <div className="grid gap-2">
                        {starterPrompts.map((prompt) => (
                          <Button
                            key={prompt}
                            className="justify-start text-left"
                            disabled={busy}
                            variant="outline"
                            onClick={() => sendMessage(prompt)}
                          >
                            <ArrowUpRight data-icon="inline-start" />
                            <span className="truncate">{prompt}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {messages.map((message) => {
                    const assistant = message.role === "assistant"

                    return (
                      <article
                        key={message.id}
                        className={`grid gap-2 ${
                          assistant
                            ? "justify-items-start"
                            : "justify-items-end"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-3 px-1 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                          <span>{getMessageLabel(message)}</span>
                          <span>{formatTimestamp(message.createdAt)}</span>
                        </div>
                        <div
                          className={`max-w-[92%] border px-4 py-3 text-sm/relaxed whitespace-pre-wrap shadow-sm sm:max-w-[78%] ${
                            assistant
                              ? "border-border bg-background/90 text-foreground"
                              : "border-foreground bg-foreground text-background"
                          }`}
                        >
                          {message.content || (
                            <span className="text-muted-foreground">
                              {message.state === "error"
                                ? "Response failed before tokens arrived."
                                : " "}
                            </span>
                          )}
                          {message.state === "streaming" ? (
                            <span className="ml-1 inline-flex size-2 animate-pulse bg-primary align-middle" />
                          ) : null}
                        </div>
                      </article>
                    )
                  })}

                  <div ref={transcriptEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border border-foreground/10 bg-card/96 backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Compose</CardTitle>
              <CardDescription>
                Press Enter to send. Use Shift+Enter for a new line.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="composer">Message</FieldLabel>
                  <Textarea
                    id="composer"
                    className="min-h-28 resize-none bg-background/80"
                    placeholder="Ask something compact. Short prompts keep local generation snappy on mobile."
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
                  <FieldDescription>
                    {pendingStop
                      ? "Stopping generation..."
                      : hasLoadedModel
                        ? "Model is warm. The transcript still disappears on refresh."
                        : "Model is cold. First send will trigger the download."}
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <Separator className="my-4" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || composer.trim().length === 0}
                    onClick={() => sendMessage()}
                  >
                    <PaperPlaneTilt data-icon="inline-start" />
                    Send
                  </Button>
                  <Button
                    disabled={runtimeStatus !== "generating"}
                    variant="secondary"
                    onClick={stopGeneration}
                  >
                    <Stop data-icon="inline-start" />
                    Stop
                  </Button>
                  <Button disabled={busy} variant="outline" onClick={initModel}>
                    <Cpu data-icon="inline-start" />
                    {hasLoadedModel ? "Reload status" : "Load model"}
                  </Button>
                </div>
                <div className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                  {CHAT_COPY.footnote}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="border border-foreground/10 bg-card/90 backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Model warmup</CardTitle>
              <CardDescription>
                Keep the loading cost explicit instead of hiding it behind the
                first prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              {loadProgress ? (
                <Progress value={loadProgress.progress ?? 8}>
                  <ProgressLabel>{loadProgress.phase}</ProgressLabel>
                  <ProgressValue>
                    {() =>
                      loadProgress.progress === null
                        ? "Preparing"
                        : `${loadProgress.progress}%`
                    }
                  </ProgressValue>
                </Progress>
              ) : (
                <div className="grid gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              )}

              <div className="grid gap-2 text-sm/relaxed text-muted-foreground">
                <p>{loadProgress?.detail ?? CHAT_COPY.warmup}</p>
                {loadProgress?.file ? (
                  <p className="truncate text-xs tracking-[0.2em] uppercase">
                    {loadProgress.file}
                  </p>
                ) : null}
                {progressMeta ? (
                  <p className="text-xs tracking-[0.2em] uppercase">
                    {progressMeta}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Alert variant="destructive">
              <Warning />
              <AlertTitle>Runtime issue</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={dismissError}>
                  Dismiss
                </Button>
              </div>
            </Alert>
          ) : null}

          <Card className="border border-foreground/10 bg-card/84 backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">
                What this app optimizes
              </CardTitle>
              <CardDescription>
                V1 is intentionally narrow so the model feels stable on phones.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 text-sm/relaxed text-muted-foreground">
              <p>
                Single thread, no history sidebar, no markdown renderer, and no
                backend sync. Everything stays in the current tab.
              </p>
              <p>
                The worker owns inference, the UI stays responsive, and the
                browser cache can reuse model artifacts after refresh.
              </p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  )
}

export default App
