import { CheckIcon, CopySimpleIcon } from "@phosphor-icons/react"

import { formatTimestamp } from "@/components/chat/chat-ui"
import { MarkdownMessage } from "@/components/markdown-message"
import { Button } from "@/components/ui/button"
import type { ChatMessage } from "@/lib/chat-types"

type ChatMessageBubbleProps = {
  copyState: "copied" | "error" | null
  message: ChatMessage
  onCopy: (message: ChatMessage) => void
}

export function ChatMessageBubble({
  copyState,
  message,
  onCopy,
}: ChatMessageBubbleProps) {
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
              {copyState === "copied" ? <CheckIcon /> : <CopySimpleIcon />}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
