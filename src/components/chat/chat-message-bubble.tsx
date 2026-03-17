import {
  ArrowClockwiseIcon,
  CheckIcon,
  CopySimpleIcon,
} from "@phosphor-icons/react"

import { formatTimestamp } from "@/components/chat/chat-ui"
import { MarkdownMessage } from "@/components/markdown-message"
import { Button } from "@/components/ui/button"
import type { ChatMessage } from "@/lib/chat-types"

type ChatMessageBubbleProps = {
  canContinue: boolean
  copyState: "copied" | "error" | null
  message: ChatMessage
  onContinue: () => void
  onCopy: (message: ChatMessage) => void
}

export function ChatMessageBubble({
  canContinue,
  copyState,
  message,
  onContinue,
  onCopy,
}: ChatMessageBubbleProps) {
  const assistant = message.role === "assistant"
  const showPendingPlaceholder =
    assistant &&
    message.state === "streaming" &&
    message.content.trim().length === 0
  const fallbackContent =
    message.content ||
    (message.state === "error" ? "Response failed before any text arrived." : "")
  const canCopy = assistant && message.content.trim().length > 0
  const hitLengthLimit = assistant && message.finishReason === "length"

  return (
    <article
      className={`flex flex-col gap-1 ${
        assistant ? "items-start" : "items-end"
      }`}
    >
      <div className="flex max-w-[88%] flex-col gap-1 sm:max-w-[72%]">
        <div
          className={`border px-4 py-3 text-sm/6 shadow-[0_6px_18px_rgba(0,0,0,0.16)] ${
            assistant
              ? "border-border bg-card text-foreground"
              : "border-primary bg-primary text-primary-foreground"
          }`}
        >
          {showPendingPlaceholder ? (
            <div className="bumblebee-waiting">
              <span
                aria-hidden="true"
                className="bumblebee-waiting__bee"
              >
                🐝
              </span>
              <span className="bumblebee-waiting__label">Bumblebee is thinking</span>
              <span aria-hidden="true" className="bumblebee-waiting__dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          ) : (
            <MarkdownMessage
              className={`bumblebee-markdown ${
                assistant
                  ? "text-foreground"
                  : "text-primary-foreground [--link-color:var(--primary-foreground)]"
              }`}
              content={fallbackContent}
              streaming={message.state === "streaming"}
            />
          )}
        </div>
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] text-muted-foreground ${
            assistant ? "justify-between" : "justify-end"
          }`}
        >
          <span>
            {assistant ? "Bumblebee" : "You"} ·{" "}
            {formatTimestamp(message.createdAt)}
          </span>
          {assistant ? (
            <div className="flex flex-wrap items-center gap-2">
              {hitLengthLimit ? (
                <span className="text-primary">Response paused</span>
              ) : null}
              {canContinue ? (
                <Button
                  className="border-primary/30 px-2 text-primary hover:bg-primary/10"
                  size="xs"
                  variant="outline"
                  onClick={onContinue}
                >
                  <ArrowClockwiseIcon data-icon="inline-start" />
                  Continue
                </Button>
              ) : null}
              {copyState ? (
                <span
                  className={
                    copyState === "error" ? "text-destructive" : "text-primary"
                  }
                >
                  {copyState === "copied" ? "Copied" : "Copy failed"}
                </span>
              ) : null}
              {canCopy ? (
                <Button
                  aria-label="Copy response"
                  className="px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  size="xs"
                  variant="ghost"
                  onClick={() => onCopy(message)}
                >
                  {copyState === "copied" ? <CheckIcon /> : <CopySimpleIcon />}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
