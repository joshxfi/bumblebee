import { describe, expect, it } from "vitest"

import {
  formatCharsShort,
  formatContextWindowLabel,
  getContextWindowStats,
} from "@/lib/context-compaction"
import type { ChatMessage } from "@/lib/chat-types"

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, "id" | "role">) {
  return {
    content: "",
    createdAt: 0,
    state: "done" as const,
    ...partial,
  } satisfies ChatMessage
}

describe("context window stats", () => {
  it("formats character counts for display", () => {
    expect(formatCharsShort(420)).toBe("420")
    expect(formatCharsShort(4200)).toBe("4.2k")
    expect(formatCharsShort(8500)).toBe("8.5k")
    expect(formatCharsShort(12000)).toBe("12k")
  })

  it("reports turn window and approximate payload size", () => {
    const messages: ChatMessage[] = [
      msg({ id: "u1", role: "user", content: "hi", createdAt: 1 }),
      msg({
        id: "a1",
        role: "assistant",
        content: "hello",
        createdAt: 2,
      }),
    ]

    const stats = getContextWindowStats(
      messages,
      "lfm2-5-350m",
      "",
      []
    )

    expect(stats.maxUserTurns).toBe(8)
    expect(stats.userTurnsInTurnWindow).toBe(1)
    expect(stats.maxPromptChars).toBeGreaterThan(0)
    expect(stats.approxPromptChars).toBeGreaterThan(0)
    expect(formatContextWindowLabel(stats)).toContain("Turns")
    expect(formatContextWindowLabel(stats)).toContain("chars")
  })
})
