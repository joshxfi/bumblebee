import type { Message } from "@huggingface/transformers"

export type ChatRole = "user" | "assistant" | "system"
export type ChatMessageState = "streaming" | "done" | "error"
export type RuntimeStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "generating"
  | "error"
export type ChatDevice = "webgpu" | "wasm"
export type FinishReason = "completed" | "stopped"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  state: ChatMessageState
}

export type ModelMessage = Pick<Message, "role" | "content">

export type ModelLoadProgress = {
  phase: string
  progress: number | null
  detail: string
  file?: string
  loaded?: number
  total?: number
}

export type WorkerRequest =
  | { type: "init" }
  | { type: "generate"; requestId: string; messages: ModelMessage[] }
  | { type: "stop" }
  | { type: "reset" }

export type WorkerEvent =
  | { type: "progress"; progress: ModelLoadProgress }
  | {
      type: "ready"
      device: ChatDevice
      dtype: string
      modelId: string
    }
  | { type: "token"; requestId: string; text: string }
  | { type: "complete"; requestId: string; finishReason: FinishReason }
  | { type: "error"; requestId?: string; error: string }
