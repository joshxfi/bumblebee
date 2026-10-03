import type { StreamChannel } from "@/lib/chat-types";

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

export type StreamSegment = { channel: StreamChannel; text: string };

/**
 * True when a rendered chat prompt leaves the model inside an open think
 * block, i.e. the template pre-opens reasoning (LFM2.5 2.6B / Thinking), so
 * the very first generated tokens are reasoning rather than answer text.
 */
export function promptOpensReasoning(prompt: string): boolean {
  return prompt.lastIndexOf(OPEN_TAG) > prompt.lastIndexOf(CLOSE_TAG);
}

/** Length of the longest suffix of `text` that is a proper prefix of `tag`. */
function partialTagLength(text: string, tag: string): number {
  for (
    let length = Math.min(text.length, tag.length - 1);
    length > 0;
    length--
  ) {
    if (tag.startsWith(text.slice(-length))) {
      return length;
    }
  }
  return 0;
}

/**
 * Splits a streamed completion into reasoning and answer segments.
 *
 * A think block may only open before any answer text has been emitted, so a
 * literal "<think>" later in an answer stays plain text. Tags split across
 * chunks are held back until they can be resolved, and whitespace at the start
 * of each section is dropped (templates pad tags with newlines).
 */
export function createReasoningSplitter({
  startInReasoning = false,
}: {
  startInReasoning?: boolean;
} = {}) {
  let channel: StreamChannel = startInReasoning ? "reasoning" : "content";
  let pending = "";
  let atSectionStart = true;
  let hasAnswerText = false;

  const take = (text: string, segments: StreamSegment[]) => {
    const value = atSectionStart ? text.trimStart() : text;
    if (!value) {
      return;
    }
    atSectionStart = false;
    if (channel === "content") {
      hasAnswerText = true;
    }
    const last = segments.at(-1);
    if (last?.channel === channel) {
      last.text += value;
    } else {
      segments.push({ channel, text: value });
    }
  };

  return {
    push(text: string): StreamSegment[] {
      const segments: StreamSegment[] = [];
      let buffer = pending + text;
      pending = "";

      while (buffer) {
        const tag =
          channel === "reasoning" ? CLOSE_TAG : hasAnswerText ? null : OPEN_TAG;

        if (!tag) {
          take(buffer, segments);
          break;
        }

        const index = buffer.indexOf(tag);
        if (
          index >= 0 &&
          (tag === CLOSE_TAG || buffer.slice(0, index).trim() === "")
        ) {
          take(buffer.slice(0, index), segments);
          channel = channel === "reasoning" ? "content" : "reasoning";
          atSectionStart = true;
          buffer = buffer.slice(index + tag.length);
          continue;
        }

        const held = partialTagLength(buffer, tag);
        take(buffer.slice(0, buffer.length - held), segments);
        pending = buffer.slice(buffer.length - held);
        break;
      }

      return segments;
    },
    /** Releases any held-back partial tag as literal text. */
    flush(): StreamSegment[] {
      const segments: StreamSegment[] = [];
      if (pending) {
        take(pending, segments);
        pending = "";
      }
      return segments;
    },
  };
}
