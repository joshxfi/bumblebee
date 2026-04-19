import { CaretDownIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ChatPerfSample } from "@/lib/chat-types"

type ChatPerfOverlayProps = {
  sample: ChatPerfSample | null
}

function formatMs(value?: number) {
  return typeof value === "number" ? `${Math.round(value)}ms` : "—"
}

function formatRate(value?: number) {
  return typeof value === "number" ? `${value.toFixed(1)} tok/s` : "—"
}

function PerfTriggerContents({ sample }: { sample: ChatPerfSample }) {
  return (
    <>
      <span className="text-sm font-medium text-foreground">Perf</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {sample.kind === "load"
            ? formatMs(sample.modelLoadMs)
            : formatRate(sample.tokensPerSec)}
        </span>
        <CaretDownIcon
          className="size-4 shrink-0 transition-transform group-aria-expanded/button:rotate-180"
          data-icon="inline-end"
        />
      </span>
    </>
  )
}

function PerfDetailsBody({ sample }: { sample: ChatPerfSample }) {
  return (
    <>
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

export function ChatPerfOverlay({ sample }: ChatPerfOverlayProps) {
  if (!sample) {
    return null
  }

  const triggerClassName = cn(
    "flex h-auto min-h-11 w-full max-w-sm items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground sm:min-h-12 sm:px-5 sm:py-3.5 md:w-72 md:max-w-none"
  )

  return (
    <div className="flex w-full shrink-0 justify-start">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-label="Performance details"
              className={triggerClassName}
              variant="outline"
            />
          }
        >
          <PerfTriggerContents sample={sample} />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="min-w-[min(calc(100vw-2rem),20rem)] max-w-[min(calc(100vw-1.5rem),24rem)] gap-0 border-border bg-popover p-0 text-sm text-muted-foreground shadow-md ring-1 ring-foreground/10 md:min-w-72"
          side="top"
          sideOffset={8}
        >
          <PopoverTitle className="sr-only">Performance details</PopoverTitle>
          <PerfDetailsBody sample={sample} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
