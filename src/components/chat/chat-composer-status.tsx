import { CpuIcon, LightningIcon, WarningIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import type { RuntimeStatus } from "@/lib/chat-types"

type ChatComposerStatusProps = {
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
}

export function ChatComposerStatus({
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
}: ChatComposerStatusProps) {
  if (error) {
    return (
      <div className="flex items-start gap-3 border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm">
        <WarningIcon className="mt-0.5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">Runtime issue</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
          {deviceProfile === "constrained" && !hasLoadedModel ? (
            <div className="mt-1 text-muted-foreground">
              This device is using the lighter model for mobile stability. If
              the tab reloads again, close other apps or tabs and retry.
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
            <LightningIcon className="shrink-0 text-primary" />
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
              Bumblebee picked the lighter model for mobile stability.
            </div>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={onInitModel}>
          <CpuIcon data-icon="inline-start" />
          Load
        </Button>
      </div>
    )
  }

  return null
}
