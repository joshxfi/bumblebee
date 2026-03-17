import { type ComponentProps } from "react"
import { ArrowClockwiseIcon, TrashSimpleIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ChatModelId, ChatModelOption } from "@/lib/chat-types"

function HeaderAction({
  label,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="border-border bg-card text-foreground hover:bg-accent"
            size="icon-sm"
            variant="outline"
            {...props}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

type ChatHeaderProps = {
  availableModels: ChatModelOption[]
  canRetry: boolean
  messagesCount: number
  mascotTone: "error" | "idle" | "loading" | "ready" | "typing"
  onClear: () => void
  onRetry: () => void
  onSelectModel: (modelId: ChatModelId) => void
  selectedModelId: ChatModelId
  selectedModelLabel: string
}

export function ChatHeader({
  availableModels,
  canRetry,
  messagesCount,
  mascotTone,
  onClear,
  onRetry,
  onSelectModel,
  selectedModelId,
  selectedModelLabel,
}: ChatHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-label="Bumblebee"
            className={`bumblebee-logo bumblebee-logo--${mascotTone}`}
            role="img"
          >
            <span aria-hidden="true" className="bumblebee-logo__glyph">
              🐝
            </span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              Bumblebee
            </div>
            <div className="truncate text-xs text-muted-foreground">
              On-device chat
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Select
            value={selectedModelId}
            onValueChange={(value) => onSelectModel(value as ChatModelId)}
          >
            <SelectTrigger
              aria-label="Select model"
              className="w-[9rem] border-border bg-card text-foreground hover:bg-accent sm:w-[11rem]"
              size="sm"
            >
              <span className="truncate">{selectedModelLabel}</span>
            </SelectTrigger>
            <SelectContent align="end" className="min-w-64 sm:min-w-72">
              <SelectGroup>
                {availableModels.map((model) => (
                  <SelectItem
                    key={model.id}
                    className="items-start py-2.5"
                    disabled={model.disabled}
                    value={model.id}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal">
                      <span className="leading-4 font-medium text-foreground">
                        {model.label}
                      </span>
                      <span className="text-[11px] leading-4 text-muted-foreground">
                        {model.disabled
                          ? "Desktop recommended"
                          : model.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <HeaderAction
            disabled={!canRetry}
            label="Retry last response"
            onClick={onRetry}
          >
            <ArrowClockwiseIcon />
          </HeaderAction>
          <HeaderAction
            disabled={messagesCount === 0}
            label="Clear conversation"
            onClick={onClear}
          >
            <TrashSimpleIcon />
          </HeaderAction>
        </div>
      </div>
    </header>
  )
}
