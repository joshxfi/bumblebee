import { CaretDownIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
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

export function ChatPerfOverlay({ sample }: ChatPerfOverlayProps) {
  if (!sample) {
    return null
  }

  return (
    <div className="fixed top-[4.75rem] right-3 z-40 hidden md:block md:right-4">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-label="Performance details"
              className="flex h-auto w-56 items-center justify-between gap-3 border-border bg-background/95 px-3 py-2 text-[11px] text-muted-foreground shadow-[0_8px_28px_rgba(0,0,0,0.25)] backdrop-blur hover:bg-background/95"
              variant="outline"
            />
          }
        >
          <span className="font-medium text-foreground">Perf</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {sample.kind === "load"
                ? formatMs(sample.modelLoadMs)
                : formatRate(sample.tokensPerSec)}
            </span>
            <CaretDownIcon
              className="size-3.5 shrink-0 transition-transform group-aria-expanded/button:rotate-180"
              data-icon="inline-end"
            />
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-56 gap-0 border-border bg-background/95 p-0 text-[11px] text-muted-foreground shadow-[0_8px_28px_rgba(0,0,0,0.25)] backdrop-blur"
          side="bottom"
          sideOffset={4}
        >
          <PopoverTitle className="sr-only">Performance details</PopoverTitle>
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-foreground">
              <span className="font-medium">Latest sample</span>
              <span>{sample.selectedModelId}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2">
            {sample.kind === "load" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>Load</span>
                  <span>{formatMs(sample.modelLoadMs)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Device</span>
                  <span>{sample.device?.toUpperCase() ?? "—"}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>First token</span>
                  <span>{formatMs(sample.firstTokenMs)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Complete</span>
                  <span>{formatMs(sample.completionMs)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Speed</span>
                  <span>{formatRate(sample.tokensPerSec)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Chars</span>
                  <span>{sample.messageChars ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Turns</span>
                  <span>{sample.historyTurnCount ?? "—"}</span>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
