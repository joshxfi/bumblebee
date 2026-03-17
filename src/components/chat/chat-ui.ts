import type { RuntimeStatus } from "@/lib/chat-types"

export const starterPrompts = [
  "Tell me a short joke.",
  "Give me three weekend ideas.",
  "Help me write a friendly text reply.",
] as const

export const statusTone: Record<
  RuntimeStatus,
  {
    label: string
    variant: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  idle: { label: "Cold", variant: "outline" },
  "loading-model": { label: "Loading", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  generating: { label: "Typing", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
}

export async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "absolute"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand("copy")
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error("Copy failed.")
  }
}

export function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}
