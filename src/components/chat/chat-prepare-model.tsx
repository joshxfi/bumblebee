import { CpuIcon, WarningIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { formatPercent } from "@/lib/chat-config"
import type { RuntimeStatus } from "@/lib/chat-types"

type ChatPrepareModelProps = {
  detail: string
  deviceProfile: "constrained" | "standard"
  error: string | null
  modelLabel: string
  onDismissError: () => void
  onInitModel: () => void
  progress: number | null
  progressMeta: string | null
  runtimeStatus: RuntimeStatus
}

export function ChatPrepareModel({
  detail,
  deviceProfile,
  error,
  modelLabel,
  onDismissError,
  onInitModel,
  progress,
  progressMeta,
  runtimeStatus,
}: ChatPrepareModelProps) {
  const formattedProgress = formatPercent(progress)

  if (error) {
    return (
      <div className="border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <WarningIcon className="shrink-0 text-destructive" />
              Runtime issue
            </div>
            <p className="mt-1 text-muted-foreground">{error}</p>
            {deviceProfile === "constrained" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                This device is using the lighter model for mobile stability.
              </p>
            ) : null}
          </div>
          <Button size="xs" variant="outline" onClick={onDismissError}>
            Dismiss
          </Button>
        </div>
      </div>
    )
  }

  if (runtimeStatus === "loading-model") {
    return (
      <div className="border border-primary/25 bg-primary/6 px-3 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-foreground">Preparing {modelLabel}</div>
            <p className="mt-1 text-muted-foreground">{detail}</p>
          </div>
          <div className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
            {formattedProgress ?? "Syncing"}
          </div>
        </div>
        <div className="mt-3">
          <Progress value={progress ?? 8}>
            <ProgressLabel>{modelLabel} warmup</ProgressLabel>
          </Progress>
        </div>
        {progressMeta ? (
          <div className="mt-2 text-xs text-muted-foreground">{progressMeta}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 border border-border bg-card px-3 py-3 text-sm">
      <div className="min-w-0">
        <div className="font-medium text-foreground">Prepare {modelLabel}</div>
        <p className="mt-1 text-muted-foreground">
          Download the tokenizer and weights into browser cache before chatting.
        </p>
        {deviceProfile === "constrained" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Bumblebee picked the lighter model for mobile stability.
          </p>
        ) : null}
      </div>
      <Button size="xs" variant="outline" onClick={onInitModel}>
        <CpuIcon data-icon="inline-start" />
        Load model
      </Button>
    </div>
  )
}
