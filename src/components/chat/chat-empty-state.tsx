import { ArrowUpRightIcon } from "@phosphor-icons/react"

import { starterPrompts } from "@/components/chat/chat-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type ChatEmptyStateProps = {
  busy: boolean
  currentModelLabel: string
  onPrompt: (prompt: string) => void
}

export function ChatEmptyState({
  busy,
  currentModelLabel,
  onPrompt,
}: ChatEmptyStateProps) {
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
            <ArrowUpRightIcon data-icon="inline-start" />
            <span className="truncate">{prompt}</span>
          </Button>
        ))}
      </div>

      <div className="mt-4 max-w-xl">
        <a
          className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          href="https://github.com/joshxfi/bumblebee"
          rel="noreferrer noopener"
          target="_blank"
        >
          <ArrowUpRightIcon />
          <span>View the project on GitHub</span>
        </a>
      </div>
    </div>
  )
}
