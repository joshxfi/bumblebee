import { GaugeIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ChatPerfSample } from "@/lib/chat-types"

type ChatPerfOverlayProps = {
  contextWindowLabel?: string | null
  sample: ChatPerfSample | null
}

function formatMs(value?: number) {
  return typeof value === "number" ? `${Math.round(value)}ms` : "—"
}

function formatRate(value?: number) {
  return typeof value === "number" ? `${value.toFixed(1)} tok/s` : "—"
}

function PerfIconTrigger({ sample }: { sample: ChatPerfSample }) {
  const headline =
    sample.kind === "load"
      ? `Model load ${formatMs(sample.modelLoadMs)}`
      : `Generation ${formatRate(sample.tokensPerSec)}`
  return (
    <>
      <GaugeIcon aria-hidden className="size-5" />
      <span className="sr-only">Performance. {headline}</span>
    </>
  )
}

function PerfDetailsBody({
  contextWindowLabel,
  sample,
}: {
  contextWindowLabel?: string | null
  sample: ChatPerfSample
}) {
  return (
    <>
      {contextWindowLabel ? (
        <div className="border-b border-border px-3 py-2.5 text-xs leading-snug text-muted-foreground">
          <div className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground/90">
            Context window
          </div>
          <p className="mt-1 font-mono text-[0.8rem] text-foreground/90">
            {contextWindowLabel}
          </p>
          <p className="mt-2 text-[0.75rem] leading-snug text-muted-foreground">
            Rough share of this model&apos;s input limit; older turns may be
            summarized when it fills up.
          </p>
        </div>
      ) : null}
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
          <span>Latest sample</span>
          <span className="truncate font-normal text-muted-foreground">
            {sample.selectedModelId}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2.5 text-sm leading-snug text-muted-foreground">
        {sample.kind === "load" ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span>Load</span>
              <span className="tabular-nums text-foreground">
                {formatMs(sample.modelLoadMs)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Device</span>
              <span className="text-foreground">
                {sample.device?.toUpperCase() ?? "—"}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span>First token</span>
              <span className="tabular-nums text-foreground">
                {formatMs(sample.firstTokenMs)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Complete</span>
              <span className="tabular-nums text-foreground">
                {formatMs(sample.completionMs)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Speed</span>
              <span className="tabular-nums text-foreground">
                {formatRate(sample.tokensPerSec)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Chars</span>
              <span className="tabular-nums text-foreground">
                {sample.messageChars ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Turns</span>
              <span className="tabular-nums text-foreground">
                {sample.historyTurnCount ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Compaction</span>
              <span className="tabular-nums text-foreground">
                {sample.compactionSummarizeMs != null
                  ? `${Math.round(sample.compactionSummarizeMs)}ms`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Dropped chars</span>
              <span className="tabular-nums text-foreground">
                {sample.compactionDroppedChars ?? "—"}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export function ChatPerfOverlay({
  contextWindowLabel,
  sample,
}: ChatPerfOverlayProps) {
  if (!sample) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-12 min-h-12 w-12 min-w-12 shrink-0 items-center justify-center p-0 outline-none"
        render={
          <Button
            aria-label="Performance details"
            className="h-12 min-h-12 w-12 min-w-12 shrink-0 rounded-none border-border p-0 [&_svg]:size-5"
            size="icon"
            title={
              sample.kind === "load"
                ? `Load ${formatMs(sample.modelLoadMs)}`
                : formatRate(sample.tokensPerSec)
            }
            type="button"
            variant="outline"
          />
        }
      >
        <PerfIconTrigger sample={sample} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="min-w-[min(calc(100vw-2rem),20rem)] max-w-[min(calc(100vw-1.5rem),24rem)] gap-0 border-border bg-popover p-0 text-sm text-muted-foreground shadow-md ring-1 ring-foreground/10 md:min-w-72"
        side="top"
        sideOffset={8}
      >
        <PopoverTitle className="sr-only">Performance details</PopoverTitle>
        <PerfDetailsBody
          contextWindowLabel={contextWindowLabel}
          sample={sample}
        />
      </PopoverContent>
    </Popover>
  )
}
