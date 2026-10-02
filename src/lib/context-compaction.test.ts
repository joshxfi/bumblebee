import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/chat-types";
import {
  clampCompactionSummary,
  collectDroppedForRetry,
  collectDroppedForSend,
  formatCharsShort,
  formatContextWindowLabel,
  getContextWindowStats,
  trimToCharBudget,
  trimTurnWindow,
} from "@/lib/context-compaction";

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, "id" | "role">) {
  return {
    content: "",
    createdAt: 0,
    state: "done" as const,
    ...partial,
  } satisfies ChatMessage;
}

describe("context window stats", () => {
  it("formats character counts for display", () => {
    expect(formatCharsShort(420)).toBe("420");
    expect(formatCharsShort(4200)).toBe("4.2k");
    expect(formatCharsShort(8500)).toBe("8.5k");
    expect(formatCharsShort(12000)).toBe("12k");
  });

  it("reports turn window and approximate payload size", () => {
    const messages: ChatMessage[] = [
      msg({ id: "u1", role: "user", content: "hi", createdAt: 1 }),
      msg({
        id: "a1",
        role: "assistant",
        content: "hello",
        createdAt: 2,
      }),
    ];

    const stats = getContextWindowStats(messages, "lfm2-5-350m", "", []);

    expect(stats.maxUserTurns).toBe(8);
    expect(stats.userTurnsInTurnWindow).toBe(1);
    expect(stats.maxPromptChars).toBeGreaterThan(0);
    expect(stats.approxPromptChars).toBeGreaterThan(0);
    expect(formatContextWindowLabel(stats)).toContain("Turns");
    expect(formatContextWindowLabel(stats)).toContain("chars");
  });
});

describe("compaction drop set", () => {
  const sized = (
    id: string,
    role: ChatMessage["role"],
    chars: number,
    createdAt: number,
  ) => msg({ id, role, content: "a".repeat(chars), createdAt });

  it("records assistant replies stripped after a dropped user turn", () => {
    const history = [
      sized("u1", "user", 3000, 1),
      sized("a1", "assistant", 3000, 2),
      sized("u2", "user", 3000, 3),
    ];

    const dropped = collectDroppedForRetry(history, "lfm2-5-350m", "");

    expect(dropped.map((message) => message.id)).toEqual(["u1", "a1"]);
  });

  it("never loses a message when the new summary is longer than the prior one", () => {
    const base = [
      sized("u1", "user", 400, 1),
      sized("a1", "assistant", 400, 2),
      sized("u2", "user", 3900, 3),
      sized("a2", "assistant", 3000, 4),
    ];
    const userMessage = sized("u3", "user", 1000, 5);

    const dropped = collectDroppedForSend(base, userMessage, "lfm2-5-350m", "");
    // Worst case: the summarizer returns a summary at the clamp limit.
    const newSummary = clampCompactionSummary("z ".repeat(2000));
    const { budgetTrimmed } = trimToCharBudget(
      trimTurnWindow([...base, userMessage], "lfm2-5-350m"),
      newSummary,
      "lfm2-5-350m",
    );

    const accountedFor = new Set(
      [...dropped, ...budgetTrimmed].map((message) => message.id),
    );
    for (const id of ["u1", "a1", "u2", "a2", "u3"]) {
      expect(accountedFor.has(id)).toBe(true);
    }
    expect(budgetTrimmed.at(-1)?.id).toBe("u3");
  });
});
