import { describe, expect, it } from "vitest";

import {
  createReasoningSplitter,
  promptOpensReasoning,
  type StreamSegment,
} from "@/lib/reasoning";

function run(chunks: string[], startInReasoning = false) {
  const splitter = createReasoningSplitter({ startInReasoning });
  const segments: StreamSegment[] = [];
  for (const chunk of chunks) {
    segments.push(...splitter.push(chunk));
  }
  segments.push(...splitter.flush());

  return {
    content: segments
      .filter((segment) => segment.channel === "content")
      .map((segment) => segment.text)
      .join(""),
    reasoning: segments
      .filter((segment) => segment.channel === "reasoning")
      .map((segment) => segment.text)
      .join(""),
  };
}

describe("createReasoningSplitter", () => {
  it("passes plain answers through untouched", () => {
    expect(run(["Hello", " there", "!"])).toEqual({
      content: "Hello there!",
      reasoning: "",
    });
  });

  it("splits a Qwen3-style think block from the answer", () => {
    expect(
      run(["<think>", "\nLet me add.\n", "</think>", "\n\n17 * 23 = 391."]),
    ).toEqual({ content: "17 * 23 = 391.", reasoning: "Let me add.\n" });
  });

  it("resolves tags split across chunks", () => {
    expect(run(["<th", "ink>plan", "</th", "ink>answer"])).toEqual({
      content: "answer",
      reasoning: "plan",
    });
  });

  it("starts in reasoning when the prompt pre-opens a think block", () => {
    expect(run(["The user wants", " a sum.", "</think>\n\n391"], true)).toEqual(
      { content: "391", reasoning: "The user wants a sum." },
    );
  });

  it("keeps a think tag that appears after answer text as literal text", () => {
    expect(run(["Use ", "<think>", " tags."])).toEqual({
      content: "Use <think> tags.",
      reasoning: "",
    });
  });

  it("releases a dangling partial tag on flush", () => {
    expect(run(["a <"])).toEqual({ content: "a <", reasoning: "" });
  });

  it("keeps reasoning when generation stops before the block closes", () => {
    expect(run(["<think>still going"])).toEqual({
      content: "",
      reasoning: "still going",
    });
  });
});

describe("promptOpensReasoning", () => {
  it("detects a template that ends inside an open think block", () => {
    expect(promptOpensReasoning("<|im_start|>assistant\n<think>")).toBe(true);
  });

  it("ignores templates that close the block (thinking disabled)", () => {
    expect(
      promptOpensReasoning("<|im_start|>assistant\n<think>\n\n</think>\n\n"),
    ).toBe(false);
    expect(promptOpensReasoning("<|im_start|>assistant\n")).toBe(false);
  });
});
