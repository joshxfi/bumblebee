import { BrainIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MarkerContent,
  MarkerIcon,
  markerVariants,
} from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ChatReasoningProps = {
  durationMs?: number;
  /** The turn ended (stopped or cut off) before the model finished thinking. */
  interrupted: boolean;
  reasoning: string;
  streaming: boolean;
};

function formatThinkingDuration(durationMs?: number) {
  if (durationMs === undefined || durationMs < 1000) {
    return "Thought for a moment";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `Thought for ${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `Thought for ${minutes}m${seconds ? ` ${seconds}s` : ""}`;
}

/**
 * Collapsible think block for reasoning models. It stays open while the model
 * is thinking, then folds away once the answer starts, unless the reader has
 * toggled it themselves.
 */
export function ChatReasoning({
  durationMs,
  interrupted,
  reasoning,
  streaming,
}: ChatReasoningProps) {
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const open = openOverride ?? streaming;
  const label = streaming
    ? "Thinking…"
    : interrupted
      ? "Stopped while thinking"
      : formatThinkingDuration(durationMs);

  // Follow the newest reasoning while it streams into the capped panel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run as reasoning grows.
  useEffect(() => {
    const node = scrollRef.current;
    if (streaming && node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [reasoning, streaming]);

  return (
    <Collapsible open={open} onOpenChange={setOpenOverride}>
      <CollapsibleTrigger
        className={cn(
          markerVariants(),
          "group/reasoning w-fit cursor-pointer outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline",
        )}
      >
        <MarkerIcon>
          {streaming ? <Spinner className="size-3.5" /> : <BrainIcon />}
        </MarkerIcon>
        <MarkerContent
          aria-live={streaming ? "polite" : undefined}
          className={cn(streaming && "shimmer")}
        >
          {label}
        </MarkerContent>
        <CaretRightIcon
          aria-hidden
          className="size-3 transition-transform duration-200 group-data-[panel-open]/reasoning:rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
        <div
          ref={scrollRef}
          className="mt-2 max-h-60 overflow-y-auto border-l-2 border-border pl-3 text-xs/5 whitespace-pre-wrap break-words text-muted-foreground scroll-fade-t"
        >
          {reasoning.trim()}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
