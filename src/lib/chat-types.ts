export type ChatRole = "user" | "assistant" | "system";
export type ChatMessageState = "streaming" | "done" | "error";
export type ChatModelDtype = "q4" | "q4f16";
export type ChatModelId =
  | "bonsai-1.7b"
  | "falcon-h1-tiny-90m-instruct"
  | "falcon-h1-tiny-multilingual-100m-instruct"
  | "gemma-3-1b-it"
  | "gemma-3-270m-it"
  | "lfm2-1.2b"
  | "lfm2-350m"
  | "lfm2-5-350m"
  | "lfm2-700m"
  | "llama-3.2-1b-instruct"
  | "qwen2.5-0.5b"
  | "qwen3-0.6b"
  | "smollm2-135m"
  | "smollm2-360m"
  | "tinyswallow-1.5b-instruct";
export type DeviceProfile = "constrained" | "standard";
export type FinishReason = "completed" | "length" | "stopped";
export type RuntimeStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "generating"
  | "error";
export type ChatDevice = "webgpu" | "wasm";

export type ChatGenerationConfig = {
  do_sample: boolean;
  max_new_tokens: number;
  repetition_penalty: number;
  return_full_text: false;
  temperature: number;
  top_p: number;
};

export type ChatGenerationOverrides = Partial<ChatGenerationConfig>;

export type ChatModelConfig = {
  compactionSummarize: ChatGenerationConfig;
  description: string;
  dtype: ChatModelDtype;
  generation: ChatGenerationConfig;
  historyTurns: number;
  id: ChatModelId;
  /** Rough cap on prompt characters (messages + injected system summary) sent to the model. */
  maxPromptChars: number;
  label: string;
  modelId: string;
  shortLabel: string;
  supportsDesktop: boolean;
  supportsMobile: boolean;
};

export type ChatModelOption = {
  description: string;
  disabled: boolean;
  id: ChatModelId;
  label: string;
  providerGroup: string;
  shortLabel: string;
  supportsDesktop: boolean;
  supportsMobile: boolean;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  finishReason?: FinishReason;
  state: ChatMessageState;
};

export type ModelMessage = {
  role: ChatRole;
  content: string;
};

export type ModelLoadProgress = {
  phase: string;
  progress: number | null;
  detail: string;
  file?: string;
  loaded?: number;
  total?: number;
};

export type ChatPerfSample = {
  compactionDroppedChars?: number;
  compactionSummarizeMs?: number;
  completionMs?: number;
  device?: ChatDevice;
  firstTokenMs?: number;
  generatedTokens?: number;
  historyTurnCount?: number;
  kind: "generation" | "load";
  messageChars?: number;
  modelLoadMs?: number;
  selectedModelId: ChatModelId;
  timestamp: number;
  tokensPerSec?: number;
};

export type WorkerRequest =
  | { type: "init"; modelId: ChatModelId }
  | {
      type: "generate";
      generationOverrides?: ChatGenerationOverrides;
      modelId: ChatModelId;
      requestId: string;
      messages: ModelMessage[];
    }
  | { type: "stop" }
  | { type: "reset" };

export type WorkerEvent =
  | { type: "progress"; modelId: ChatModelId; progress: ModelLoadProgress }
  | {
      type: "ready";
      modelId: ChatModelId;
      device: ChatDevice;
      dtype: string;
    }
  | { type: "token"; modelId: ChatModelId; requestId: string; text: string }
  | {
      type: "complete";
      generatedTokens: number;
      modelId: ChatModelId;
      requestId: string;
      finishReason: FinishReason;
    }
  | { type: "error"; modelId?: ChatModelId; requestId?: string; error: string };
