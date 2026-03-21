import { CaretDownIcon } from "@phosphor-icons/react"
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
    <details className="group fixed top-[4.75rem] right-3 z-40 hidden w-56 border border-border bg-background/95 text-[11px] text-muted-foreground shadow-[0_8px_28px_rgba(0,0,0,0.25)] backdrop-blur md:block md:right-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Perf</span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {sample.kind === "load"
              ? formatMs(sample.modelLoadMs)
              : formatRate(sample.tokensPerSec)}
          </span>
          <CaretDownIcon className="size-3.5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <aside className="border-t border-border px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-foreground">
          <span className="font-medium">Latest sample</span>
          <span>{sample.selectedModelId}</span>
        </div>
        {sample.kind === "load" ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span>Load</span>
              <span>{formatMs(sample.modelLoadMs)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Device</span>
              <span>{sample.device?.toUpperCase() ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
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
          </div>
        )}
      </aside>
    </details>
  )
}
