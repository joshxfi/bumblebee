import { type ComponentProps, useSyncExternalStore } from "react"
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CheckIcon,
  DesktopIcon,
  DeviceMobileIcon,
  InfoIcon,
  TrashSimpleIcon,
} from "@phosphor-icons/react"
import { Link } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getProviderGroupDescription,
  groupChatModelsByProvider,
} from "@/lib/chat-config"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ChatModelId, ChatModelOption } from "@/lib/chat-types"
import { cn } from "@/lib/utils"

function useSubmenuSideForViewport(): "bottom" | "right" {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => undefined
      }
      const mq = window.matchMedia("(max-width: 640px)")
      mq.addEventListener("change", onStoreChange)
      return () => mq.removeEventListener("change", onStoreChange)
    },
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches
        ? "bottom"
        : "right",
    () => "right"
  )
}

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
  modelSelectionDisabled?: boolean
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
  modelSelectionDisabled = false,
  onClear,
  onRetry,
  onSelectModel,
  selectedModelId,
  selectedModelLabel,
}: ChatHeaderProps) {
  const submenuSide = useSubmenuSideForViewport()
  const providerGroups = groupChatModelsByProvider(availableModels)

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
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  aria-label="About Bumblebee"
                  className={cn(
                    buttonVariants({
                      className:
                        "border-border bg-card text-foreground hover:bg-accent",
                      size: "icon-sm",
                      variant: "outline",
                    })
                  )}
                  to="/about"
                >
                  <InfoIcon aria-hidden weight="fill" />
                </Link>
              }
            />
            <TooltipContent>About Bumblebee</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Select model"
                  className="w-[9rem] justify-between border-border bg-card text-foreground hover:bg-accent sm:w-[11rem]"
                  disabled={modelSelectionDisabled}
                  size="sm"
                  variant="outline"
                />
              }
            >
              <span className="truncate text-left">{selectedModelLabel}</span>
              <CaretDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[calc(100dvh-4.5rem)] min-w-60 w-(--anchor-width) overflow-y-auto sm:min-w-64"
              side="bottom"
              sideOffset={4}
            >
              {providerGroups.map(({ providerGroup, models }) => {
                const selectedInGroup = models.find(
                  (m) => m.id === selectedModelId
                )
                return (
                  <DropdownMenuSub key={providerGroup}>
                    <DropdownMenuSubTrigger className="min-h-11 items-start gap-2 py-3.5 text-sm sm:min-h-0 sm:items-center sm:py-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                        <span className="flex w-full min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-foreground">
                            {providerGroup}
                          </span>
                          {selectedInGroup ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {selectedInGroup.shortLabel}
                            </span>
                          ) : null}
                        </span>
                        <span className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                          {getProviderGroupDescription(providerGroup)}
                        </span>
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      align="start"
                      className="max-h-[min(72dvh,30rem)] max-w-[min(calc(100vw-1.5rem),24rem)] min-w-[min(calc(100vw-1.5rem),20rem)] overflow-y-auto p-0 text-sm"
                      side={submenuSide}
                      sideOffset={submenuSide === "bottom" ? 4 : 2}
                    >
                      <div className="flex flex-col gap-px py-1">
                        {models.map((model) => (
                          <DropdownMenuItem
                            key={model.id}
                            className="min-h-11 cursor-pointer flex-col items-stretch gap-1.5 rounded-none px-3 py-3.5 text-sm sm:min-h-0 sm:px-2.5 sm:py-3"
                            disabled={model.disabled}
                            onClick={() => onSelectModel(model.id)}
                          >
                            <span className="flex min-w-0 flex-col gap-1">
                              <span className="flex min-w-0 items-start justify-between gap-2">
                                <span className="min-w-0 flex-1 font-medium text-foreground leading-snug">
                                  {model.label}
                                </span>
                                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                                  {model.id === selectedModelId ? (
                                    <CheckIcon
                                      aria-hidden
                                      className="text-foreground"
                                    />
                                  ) : null}
                                  {model.supportsMobile ? (
                                    <DeviceMobileIcon
                                      aria-label="Mobile supported"
                                      className="size-3.5"
                                      weight="fill"
                                    />
                                  ) : null}
                                  {model.supportsDesktop ? (
                                    <DesktopIcon
                                      aria-label="Desktop supported"
                                      className="size-3.5"
                                      weight="fill"
                                    />
                                  ) : null}
                                </span>
                              </span>
                              <span className="text-xs leading-relaxed text-muted-foreground">
                                {model.disabled
                                  ? "Desktop only"
                                  : model.description}
                              </span>
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
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
