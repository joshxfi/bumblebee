import { describe, expect, it } from "vitest";
import { isSubmitEnter } from "@/components/chat/chat-ui";

const enter = {
  isComposing: false,
  key: "Enter",
  keyCode: 13,
  shiftKey: false,
};

describe("isSubmitEnter", () => {
  it("submits on a plain Enter", () => {
    expect(isSubmitEnter(enter)).toBe(true);
  });

  it("keeps Shift+Enter for newlines", () => {
    expect(isSubmitEnter({ ...enter, shiftKey: true })).toBe(false);
  });

  it("ignores Enter while an IME composition is active", () => {
    expect(isSubmitEnter({ ...enter, isComposing: true })).toBe(false);
  });

  it("ignores Safari's IME confirm keydown", () => {
    expect(isSubmitEnter({ ...enter, keyCode: 229 })).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isSubmitEnter({ ...enter, key: "a", keyCode: 65 })).toBe(false);
  });
});
