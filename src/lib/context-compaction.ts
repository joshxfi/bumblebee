import { getModelConfig } from "@/lib/chat-config";
import type { ChatMessage, ChatModelId, ModelMessage } from "@/lib/chat-types";

export function pruneConversation(messages: ChatMessage[]) {
  return messages.filter((message) => {
    if (message.role !== "assistant") {
      return true;
    }

    return message.content.trim().length > 0 && message.state !== "error";
  });
}

/** Keeps recent user-turn window; trims from the oldest side. */
export function trimTurnWindow(messages: ChatMessage[], modelId: ChatModelId) {
  const visibleMessages = pruneConversation(messages);
  const historyTurns = getModelConfig(modelId).historyTurns;

  let userTurns = 0;
  let startIndex = 0;

  for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
    if (visibleMessages[index]?.role === "user") {
      userTurns += 1;

      if (userTurns > historyTurns) {
        startIndex = index + 1;
        break;
      }
    }
  }

  while (visibleMessages[startIndex]?.role === "assistant") {
    startIndex += 1;
  }

  return visibleMessages.slice(startIndex);
}

export const ROLLING_SUMMARY_SYSTEM_PREFIX =
  "Prior conversation (compressed). Treat this as background memory only; the messages that follow are the active chat thread.";

function estimateCharsForPayload(messages: ModelMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

function stripLeadingAssistants(messages: ChatMessage[]): ChatMessage[] {
  let startIndex = 0;

  while (messages[startIndex]?.role === "assistant") {
    startIndex += 1;
  }

  return messages.slice(startIndex);
}

/**
 * Drops whole messages from the front until the payload (system summary + trimmed)
 * fits maxPromptChars.
 */
export function trimToCharBudget(
  trimmed: ChatMessage[],
  rollingSummaryForPrompt: string,
  modelId: ChatModelId,
  trailingPayloadFragments: ModelMessage[] = [],
): { budgetTrimmed: ChatMessage[]; droppedFromBudget: ChatMessage[] } {
  const maxPromptChars = getModelConfig(modelId).maxPromptChars;
  const systemStub: ModelMessage | null =
    rollingSummaryForPrompt.trim().length > 0
      ? {
          role: "system",
          content: `${ROLLING_SUMMARY_SYSTEM_PREFIX}\n\n${rollingSummaryForPrompt.trim()}`,
        }
      : null;

  let working = stripLeadingAssistants(trimmed);
  const droppedFromBudget: ChatMessage[] = [];

  const fits = (slice: ChatMessage[]) => {
    const body: ModelMessage[] = slice.map(({ role, content }) => ({
      role,
      content,
    }));
    const combined = [
      ...(systemStub ? [systemStub] : []),
      ...body,
      ...trailingPayloadFragments,
    ];
    return estimateCharsForPayload(combined) <= maxPromptChars;
  };

  while (working.length > 0 && !fits(working)) {
    const dropped = working[0];
    if (!dropped) {
      break;
    }
    droppedFromBudget.push(dropped);
    working = stripLeadingAssistants(working.slice(1));
  }

  return { budgetTrimmed: working, droppedFromBudget };
}

export function serializeMessagesForSummary(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const roleLabel =
        message.role === "user"
          ? "User"
          : message.role === "assistant"
            ? "Assistant"
            : "System";
      return `${roleLabel}: ${message.content}`;
    })
    .join("\n\n");
}

export function mergeDroppedMessages(
  turnDropped: ChatMessage[],
  budgetDropped: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...turnDropped, ...budgetDropped]) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/** Messages that leave the window on this send (turn shift and/or char budget). Used for summarization + UI gating. */
export function collectDroppedForSend(
  baseMessages: ChatMessage[],
  userMessage: ChatMessage,
  modelId: ChatModelId,
  priorRollingSummary: string,
): ChatMessage[] {
  const afterTurn = trimTurnWindow([...baseMessages, userMessage], modelId);
  const beforeTurn = trimTurnWindow(baseMessages, modelId);
  const afterIds = new Set(afterTurn.map((message) => message.id));
  const dropTurn = beforeTurn.filter((message) => !afterIds.has(message.id));

  const { droppedFromBudget } = trimToCharBudget(
    afterTurn,
    priorRollingSummary,
    modelId,
  );

  return mergeDroppedMessages(dropTurn, droppedFromBudget);
}

export function collectDroppedForRetry(
  history: ChatMessage[],
  modelId: ChatModelId,
  priorRollingSummary: string,
): ChatMessage[] {
  const afterTurn = trimTurnWindow(history, modelId);
  const { droppedFromBudget } = trimToCharBudget(
    afterTurn,
    priorRollingSummary,
    modelId,
  );

  return mergeDroppedMessages([], droppedFromBudget);
}

export function collectDroppedForContinue(
  messages: ChatMessage[],
  modelId: ChatModelId,
  priorRollingSummary: string,
  continueTail: ModelMessage[],
): ChatMessage[] {
  const afterTurn = trimTurnWindow(messages, modelId);
  const { droppedFromBudget } = trimToCharBudget(
    afterTurn,
    priorRollingSummary,
    modelId,
    continueTail,
  );

  return mergeDroppedMessages([], droppedFromBudget);
}

export function buildSystemSummaryMessage(
  summaryText: string,
): ModelMessage | null {
  const trimmed = summaryText.trim();
  if (!trimmed) {
    return null;
  }

  return {
    role: "system",
    content: `${ROLLING_SUMMARY_SYSTEM_PREFIX}\n\n${trimmed}`,
  };
}

export function chatMessagesToModelMessages(
  messages: ChatMessage[],
): ModelMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

/** Single-turn instruct prompt for rolling compaction (fits small local models). */
export function buildCompactionSummarizeMessages(
  priorSummary: string,
  droppedTranscript: string,
): ModelMessage[] {
  const instruction = `You merge chat history into a compact bullet list for long-term memory. Stay under 800 characters. Output bullets only — no preamble or closing.

Prior summary (may be empty):
${priorSummary.trim() || "(none)"}

Messages removed from the active context window:
${droppedTranscript.trim() || "(none)"}

Write an updated bullet summary merging prior facts with the new material. Focus on facts, decisions, code, names, and open questions.`;

  return [{ role: "user", content: instruction }];
}

export function clampCompactionSummary(text: string, maxChars = 1200) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  // Prefer cutting at the last word boundary so we don't truncate mid-word,
  // but fall back to a hard clip if there's no reasonable break near the end.
  const hardClip = trimmed.slice(0, maxChars);
  const lastBreak = hardClip.lastIndexOf(" ");
  const clipped =
    lastBreak > maxChars * 0.6 ? hardClip.slice(0, lastBreak) : hardClip;
  return `${clipped.trimEnd()}…`;
}

export type ContextWindowStats = {
  /** Sum of characters for system summary + trimmed messages + optional trailing fragments (e.g. continue prompt). */
  approxPromptChars: number;
  maxPromptChars: number;
  maxUserTurns: number;
  /** User messages retained after the turn window trim (before optional char-budget drops). */
  userTurnsInTurnWindow: number;
};

/**
 * Approximate next-request footprint using the same trim + budget rules as payload building.
 */
export function getContextWindowStats(
  messages: ChatMessage[],
  modelId: ChatModelId,
  rollingContextSummary: string,
  trailingPayloadFragments: ModelMessage[] = [],
): ContextWindowStats {
  const config = getModelConfig(modelId);
  const afterTurn = trimTurnWindow(pruneConversation(messages), modelId);

  const userTurnsInTurnWindow = afterTurn.reduce(
    (count, message) => count + (message.role === "user" ? 1 : 0),
    0,
  );

  const { budgetTrimmed } = trimToCharBudget(
    afterTurn,
    rollingContextSummary,
    modelId,
    trailingPayloadFragments,
  );

  const systemMessage = buildSystemSummaryMessage(rollingContextSummary);
  const body = chatMessagesToModelMessages(budgetTrimmed);
  const combined = [
    ...(systemMessage ? [systemMessage] : []),
    ...body,
    ...trailingPayloadFragments,
  ];

  const approxPromptChars = combined.reduce(
    (total, message) => total + message.content.length,
    0,
  );

  return {
    approxPromptChars,
    maxPromptChars: config.maxPromptChars,
    maxUserTurns: config.historyTurns,
    userTurnsInTurnWindow,
  };
}

/** Compact label for header/tooltips (e.g. ~4.2k / 8.5k). */
export function formatCharsShort(value: number) {
  if (value < 1000) {
    return `${Math.round(value)}`;
  }
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
}

export function formatContextWindowLabel(stats: ContextWindowStats) {
  const turns = `${stats.userTurnsInTurnWindow}/${stats.maxUserTurns}`;
  const chars = `~${formatCharsShort(stats.approxPromptChars)}/${formatCharsShort(stats.maxPromptChars)}`;
  return `Turns ${turns} · ${chars} chars`;
}
