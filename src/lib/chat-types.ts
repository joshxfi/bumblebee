import type { Message } from "@huggingface/transformers"

export type ChatRole = "user" | "assistant" | "system"
export type ChatMessageState = "streaming" | "done" | "error"
export type ChatModelId = "lfm2-350m" | "smollm2-135m"
export type DeviceProfile = "constrained" | "standard"
export type FinishReason = "completed" | "length" | "stopped"
export type RuntimeStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "generating"
  | "error"
export type ChatDevice = "webgpu" | "wasm"

export type ChatModelConfig = {
  description: string
  deviceLabel: string
  disabledOnConstrained: boolean
  dtype: "q4"
  generation: {
    do_sample: boolean
    max_new_tokens: number
    repetition_penalty: number
    return_full_text: false
    temperature: number
    top_p: number
  }
  id: ChatModelId
  label: string
  modelId: string
  shortLabel: string
}

export type ChatModelOption = {
  description: string
  disabled: boolean
  id: ChatModelId
  label: string
  shortLabel: string
}

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  finishReason?: FinishReason
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
  | { type: "init"; modelId: ChatModelId }
  | {
      type: "generate"
      modelId: ChatModelId
      requestId: string
      messages: ModelMessage[]
    }
  | { type: "stop" }
  | { type: "reset" }

export type WorkerEvent =
  | { type: "progress"; modelId: ChatModelId; progress: ModelLoadProgress }
  | {
      type: "ready"
      modelId: ChatModelId
      device: ChatDevice
      dtype: string
    }
  | { type: "token"; modelId: ChatModelId; requestId: string; text: string }
  | {
      type: "complete"
      modelId: ChatModelId
      requestId: string
      finishReason: FinishReason
    }
  | { type: "error"; modelId?: ChatModelId; requestId?: string; error: string }
