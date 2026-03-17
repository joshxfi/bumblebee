import type {
  ChatModelConfig,
  ChatModelId,
  ChatModelOption,
  DeviceProfile,
} from "@/lib/chat-types"

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number
}

const desktopModel: ChatModelConfig = {
  description: "Desktop recommended for longer, richer replies.",
  deviceLabel: "Desktop recommended",
  disabledOnConstrained: true,
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 88,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.72,
    top_p: 0.92,
  },
  id: "lfm2-350m",
  label: "LFM2 350M",
  modelId: "onnx-community/LFM2-350M-ONNX",
  shortLabel: "350M",
}

const mobileModel: ChatModelConfig = {
  description: "Smaller on-device model chosen for iPhone and low-memory devices.",
  deviceLabel: "Mobile safe",
  disabledOnConstrained: false,
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 64,
    repetition_penalty: 1.05,
    return_full_text: false,
    temperature: 0.7,
    top_p: 0.9,
  },
  id: "smollm2-135m",
  label: "SmolLM2 135M",
  modelId: "onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",
  shortLabel: "135M",
}

export const CHAT_MODELS: Record<ChatModelId, ChatModelConfig> = {
  "lfm2-350m": desktopModel,
  "smollm2-135m": mobileModel,
}

export const DEFAULT_MODEL_ID: ChatModelId = "lfm2-350m"

export const CHAT_COPY = {
  subtitle:
    "On-device replies with no account, no backend, and no saved transcript.",
  warmup:
    "First run downloads the tokenizer and weights from Hugging Face, then the browser cache handles repeat visits.",
  footnote:
    "Bumblebee uses a lighter model on iPhone and other constrained devices to reduce browser crashes.",
} as const

export function getModelConfig(modelId: ChatModelId) {
  return CHAT_MODELS[modelId]
}

export function getModelOptions(
  profile: DeviceProfile
): Array<ChatModelOption> {
  return Object.values(CHAT_MODELS).map((model) => ({
    description:
      profile === "constrained" && model.disabledOnConstrained
        ? `${model.description} Unavailable on this device.`
        : model.description,
    disabled: profile === "constrained" && model.disabledOnConstrained,
    id: model.id,
    label: model.label,
    shortLabel: model.shortLabel,
  }))
}

export function getRecommendedModelId(profile: DeviceProfile): ChatModelId {
  return profile === "constrained" ? "smollm2-135m" : DEFAULT_MODEL_ID
}

export function getDeviceProfile(
  targetNavigator: Navigator | undefined = typeof navigator !== "undefined"
    ? navigator
    : undefined
): DeviceProfile {
  if (!targetNavigator) {
    return "standard"
  }

  const userAgent = targetNavigator.userAgent ?? ""
  const platform = targetNavigator.platform ?? ""
  const maxTouchPoints = targetNavigator.maxTouchPoints ?? 0
  const deviceMemory = (targetNavigator as NavigatorWithDeviceMemory).deviceMemory

  const isIosDevice = /iPhone|iPad|iPod/i.test(userAgent)
  const isTouchMac = platform === "MacIntel" && maxTouchPoints > 1
  const isLowMemoryDevice =
    typeof deviceMemory === "number" && deviceMemory <= 4

  return isIosDevice || isTouchMac || isLowMemoryDevice
    ? "constrained"
    : "standard"
}

export function formatBytes(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return null
  }

  if (value < 1024) {
    return `${value} B`
  }

  const units = ["KB", "MB", "GB"]
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}
