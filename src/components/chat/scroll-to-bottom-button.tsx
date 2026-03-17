import { ArrowDownIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

type ScrollToBottomButtonProps = {
  onScrollToBottom: () => void
  offsetClassName: string
  visible: boolean
}

export function ScrollToBottomButton({
  onScrollToBottom,
  offsetClassName,
  visible,
}: ScrollToBottomButtonProps) {
  if (!visible) {
    return null
  }

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-20 ${offsetClassName}`}
    >
      <div className="mx-auto flex w-full max-w-3xl justify-end px-3 sm:px-4">
        <Button
          aria-label="Scroll to latest messages"
          className="pointer-events-auto border border-border shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
          size="icon-sm"
          variant="secondary"
          onClick={onScrollToBottom}
        >
          <ArrowDownIcon />
        </Button>
      </div>
    </div>
  )
}
