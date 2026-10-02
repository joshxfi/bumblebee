import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerEvent, WorkerRequest } from "@/lib/chat-types";

type StreamerOptions = {
  callback_function?: (text: string) => void;
  token_callback_function?: (tokens: bigint[]) => void;
};

const fakeModel = vi.hoisted(() => ({
  /** Text chunks each fake generation emits, one per macrotask. */
  tokens: [] as string[],
}));

vi.mock("@huggingface/transformers", () => {
  class InterruptableStoppingCriteria {
    interrupted = false;
    interrupt() {
      this.interrupted = true;
    }
    reset() {
      this.interrupted = false;
    }
  }

  class StoppingCriteriaList {
    items: InterruptableStoppingCriteria[] = [];
    push(item: InterruptableStoppingCriteria) {
      this.items.push(item);
    }
  }

  class TextStreamer {
    options: StreamerOptions;
    constructor(_tokenizer: unknown, options: StreamerOptions) {
      this.options = options;
    }
  }

  const generator = Object.assign(
    async (
      _messages: unknown,
      options: {
        stopping_criteria: StoppingCriteriaList;
        streamer: TextStreamer;
      },
    ) => {
      for (const token of fakeModel.tokens) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (options.stopping_criteria.items.some((item) => item.interrupted)) {
          break;
        }
        options.streamer.options.token_callback_function?.([1n]);
        options.streamer.options.callback_function?.(token);
      }
    },
    { tokenizer: {} },
  );

  return {
    env: {},
    InterruptableStoppingCriteria,
    StoppingCriteriaList,
    TextStreamer,
    pipeline: vi.fn(async () => generator),
  };
});

let posted: WorkerEvent[] = [];
let registered: Array<[string, EventListener]> = [];

function send(request: WorkerRequest) {
  self.dispatchEvent(new MessageEvent("message", { data: request }));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenText(requestId: string) {
  return posted
    .filter(
      (event): event is Extract<WorkerEvent, { type: "token" }> =>
        event.type === "token" && event.requestId === requestId,
    )
    .map((event) => event.text)
    .join("");
}

beforeEach(async () => {
  posted = [];
  registered = [];
  fakeModel.tokens = ["t0", "t1", "t2", "t3", "t4", "t5"];
  vi.resetModules();
  vi.spyOn(self, "postMessage").mockImplementation(((event: WorkerEvent) => {
    posted.push(event);
  }) as typeof self.postMessage);
  // Track the worker's listeners so each test starts with a fresh module.
  const addEventListener = self.addEventListener.bind(self);
  vi.spyOn(self, "addEventListener").mockImplementation(((
    type: string,
    listener: EventListener,
  ) => {
    registered.push([type, listener]);
    addEventListener(type, listener);
  }) as typeof self.addEventListener);
  await import("./chat.worker");
});

afterEach(() => {
  for (const [type, listener] of registered) {
    self.removeEventListener(type, listener);
  }
  vi.restoreAllMocks();
});

describe("chat worker", () => {
  it("streams tokens and completes a generation", async () => {
    send({
      type: "generate",
      modelId: "lfm2-5-350m",
      requestId: "a",
      messages: [{ role: "user", content: "hi" }],
    });
    await wait(150);

    expect(tokenText("a")).toBe("t0t1t2t3t4t5");
    expect(posted.at(-1)).toMatchObject({
      type: "complete",
      requestId: "a",
      finishReason: "completed",
    });
  });

  it("stops the running generation on reset and keeps the next request intact", async () => {
    send({
      type: "generate",
      modelId: "lfm2-5-350m",
      requestId: "a",
      messages: [],
    });
    await wait(5);
    send({ type: "reset" });
    send({
      type: "generate",
      modelId: "lfm2-5-350m",
      requestId: "b",
      messages: [],
    });
    await wait(200);

    expect(tokenText("b")).toBe("t0t1t2t3t4t5");
    expect(posted).toContainEqual(
      expect.objectContaining({
        type: "complete",
        requestId: "a",
        finishReason: "stopped",
      }),
    );
    // a must finish before b starts producing output (runs are serialized).
    const completeA = posted.findIndex(
      (event) => event.type === "complete" && event.requestId === "a",
    );
    const firstTokenB = posted.findIndex(
      (event) => event.type === "token" && event.requestId === "b",
    );
    expect(completeA).toBeLessThan(firstTokenB);
  });

  it("marks a stopped generation as stopped", async () => {
    send({
      type: "generate",
      modelId: "lfm2-5-350m",
      requestId: "a",
      messages: [],
    });
    await wait(5);
    send({ type: "stop" });
    await wait(100);

    expect(posted.at(-1)).toMatchObject({
      type: "complete",
      requestId: "a",
      finishReason: "stopped",
    });
  });
});
