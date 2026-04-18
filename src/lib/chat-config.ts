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
  description: "Balanced default for most devices with solid local chat quality.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 192,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.72,
    top_p: 0.92,
  },
  historyTurns: 8,
  id: "lfm2-350m",
  label: "LFM2 350M",
  modelId: "onnx-community/LFM2-350M-ONNX",
  shortLabel: "350M",
  supportsDesktop: true,
  supportsMobile: true,
}

const desktopModelLfm25: ChatModelConfig = {
  description:
    "Liquid LFM2.5 350M refresh with improved quality in the same lightweight footprint as LFM2 350M.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 192,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.72,
    top_p: 0.92,
  },
  historyTurns: 8,
  id: "lfm2-5-350m",
  label: "LFM2.5 350M",
  modelId: "onnx-community/LFM2.5-350M-ONNX",
  shortLabel: "2.5 350M",
  supportsDesktop: true,
  supportsMobile: true,
}

const desktopQualityModel: ChatModelConfig = {
  description: "Stronger desktop-only upgrade for richer local answers.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 224,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.68,
    top_p: 0.9,
  },
  historyTurns: 10,
  id: "lfm2-700m",
  label: "LFM2 700M",
  modelId: "onnx-community/LFM2-700M-ONNX",
  shortLabel: "700M",
  supportsDesktop: true,
  supportsMobile: false,
}

const desktopExperimentalModel: ChatModelConfig = {
  description: "Strongest local desktop option in the current Bumblebee catalog.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 256,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.66,
    top_p: 0.9,
  },
  historyTurns: 10,
  id: "lfm2-1.2b",
  label: "LFM2 1.2B",
  modelId: "onnx-community/LFM2-1.2B-ONNX",
  shortLabel: "1.2B",
  supportsDesktop: true,
  supportsMobile: false,
}

const smallQualityModel: ChatModelConfig = {
  description: "Stronger mobile step-up with better response quality.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 144,
    repetition_penalty: 1.05,
    return_full_text: false,
    temperature: 0.72,
    top_p: 0.92,
  },
  historyTurns: 6,
  id: "smollm2-360m",
  label: "SmolLM2 360M",
  modelId: "onnx-community/SmolLM2-360M-ONNX",
  shortLabel: "360M",
  supportsDesktop: true,
  supportsMobile: true,
}

const mobileModel: ChatModelConfig = {
  description: "Safest mobile option and the fastest lightweight starting point.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 128,
    repetition_penalty: 1.05,
    return_full_text: false,
    temperature: 0.7,
    top_p: 0.9,
  },
  historyTurns: 6,
  id: "smollm2-135m",
  label: "SmolLM2 135M",
  modelId: "onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",
  shortLabel: "135M",
  supportsDesktop: true,
  supportsMobile: true,
}

const compactGeneralModel: ChatModelConfig = {
  description: "Stronger all-around small chat model while staying browser friendly.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 176,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.7,
    top_p: 0.9,
  },
  historyTurns: 8,
  id: "qwen2.5-0.5b",
  label: "Qwen2.5 0.5B",
  modelId: "onnx-community/Qwen2.5-0.5B-Instruct-ONNX-MHA",
  shortLabel: "0.5B",
  supportsDesktop: true,
  supportsMobile: true,
}

const gemma3_270mModel: ChatModelConfig = {
  description:
    "Compact instruct model that stays friendlier on modest hardware and mobile.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 168,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.7,
    top_p: 0.9,
  },
  historyTurns: 8,
  id: "gemma-3-270m-it",
  label: "Gemma 3 270M",
  modelId: "onnx-community/gemma-3-270m-it-ONNX",
  shortLabel: "Gemma270M",
  supportsDesktop: true,
  supportsMobile: true,
}

const qwen3_0_6bModel: ChatModelConfig = {
  description:
    "Tiny Qwen3 instruct tune with strong multilingual habits in a browser-friendly size.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 176,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.7,
    top_p: 0.9,
  },
  historyTurns: 8,
  id: "qwen3-0.6b",
  label: "Qwen3 0.6B",
  modelId: "onnx-community/Qwen3-0.6B-ONNX",
  shortLabel: "Qwen3",
  supportsDesktop: true,
  supportsMobile: true,
}

const falconH1TinyModel: ChatModelConfig = {
  description:
    "Ultra-light Falcon H1 Edge instruct (~90M) for quick experiments on modest or mobile hardware.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 160,
    repetition_penalty: 1.06,
    return_full_text: false,
    temperature: 0.72,
    top_p: 0.92,
  },
  historyTurns: 8,
  id: "falcon-h1-tiny-90m-instruct",
  label: "Falcon H1 Tiny 90M",
  modelId: "onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX",
  shortLabel: "Falcon90M",
  supportsDesktop: true,
  supportsMobile: true,
}

const falconH1TinyMultilingualModel: ChatModelConfig = {
  description:
    "Falcon H1 Edge multilingual instruct (~100M) for mixed-language chat in a still-light footprint.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 176,
    repetition_penalty: 1.07,
    return_full_text: false,
    temperature: 0.7,
    top_p: 0.9,
  },
  historyTurns: 8,
  id: "falcon-h1-tiny-multilingual-100m-instruct",
  label: "Falcon H1 Tiny Multilingual 100M",
  modelId: "onnx-community/Falcon-H1-Tiny-Multilingual-100M-Instruct-ONNX",
  shortLabel: "Falcon100M",
  supportsDesktop: true,
  supportsMobile: true,
}

const llama32_1bModel: ChatModelConfig = {
  description:
    "Popular small Llama instruct tune for reliable desktop chat quality.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 224,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.68,
    top_p: 0.9,
  },
  historyTurns: 10,
  id: "llama-3.2-1b-instruct",
  label: "Llama 3.2 1B",
  modelId: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
  shortLabel: "Llama1B",
  supportsDesktop: true,
  supportsMobile: false,
}

const gemma3_1bModel: ChatModelConfig = {
  description: "Slightly larger Gemma 3 instruct for better nuance on desktop.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 224,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.68,
    top_p: 0.9,
  },
  historyTurns: 10,
  id: "gemma-3-1b-it",
  label: "Gemma 3 1B",
  modelId: "onnx-community/gemma-3-1b-it-ONNX",
  shortLabel: "Gemma1B",
  supportsDesktop: true,
  supportsMobile: false,
}

const tinySwallowModel: ChatModelConfig = {
  description: "Dense 1.5B instruct alternative for richer desktop replies.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 240,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.67,
    top_p: 0.9,
  },
  historyTurns: 10,
  id: "tinyswallow-1.5b-instruct",
  label: "TinySwallow 1.5B",
  modelId: "onnx-community/TinySwallow-1.5B-Instruct-ONNX",
  shortLabel: "Swallow",
  supportsDesktop: true,
  supportsMobile: false,
}

const bonsaiModel: ChatModelConfig = {
  description:
    "Stronger desktop-only dense option for richer replies at a mid-size footprint.",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 224,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.68,
    top_p: 0.9,
  },
  historyTurns: 8,
  id: "bonsai-1.7b",
  label: "Bonsai 1.7B",
  modelId: "onnx-community/Bonsai-1.7B-ONNX",
  shortLabel: "Bonsai",
  supportsDesktop: true,
  supportsMobile: false,
}

export const CHAT_MODELS: Record<ChatModelId, ChatModelConfig> = {
  "smollm2-135m": mobileModel,
  "smollm2-360m": smallQualityModel,
  "gemma-3-270m-it": gemma3_270mModel,
  "qwen2.5-0.5b": compactGeneralModel,
  "qwen3-0.6b": qwen3_0_6bModel,
  "falcon-h1-tiny-90m-instruct": falconH1TinyModel,
  "falcon-h1-tiny-multilingual-100m-instruct": falconH1TinyMultilingualModel,
  "lfm2-350m": desktopModel,
  "lfm2-5-350m": desktopModelLfm25,
  "lfm2-700m": desktopQualityModel,
  "llama-3.2-1b-instruct": llama32_1bModel,
  "gemma-3-1b-it": gemma3_1bModel,
  "lfm2-1.2b": desktopExperimentalModel,
  "tinyswallow-1.5b-instruct": tinySwallowModel,
  "bonsai-1.7b": bonsaiModel,
}

export const DEFAULT_MODEL_ID: ChatModelId = "lfm2-350m"

export const CHAT_COPY = {
  subtitle:
    "On-device replies with no account, no backend, and no saved transcript.",
  warmup:
    "First run downloads the tokenizer and weights from Hugging Face, then the browser cache handles repeat visits.",
  footnote:
    "Bumblebee uses a lighter model on mobile and other constrained devices to reduce browser crashes.",
} as const

export function getModelConfig(modelId: ChatModelId) {
  return CHAT_MODELS[modelId]
}

const PROVIDER_GROUP_ORDER = [
  "SmolLM",
  "Gemma",
  "Qwen",
  "Falcon",
  "LFM",
  "Llama",
  "TinySwallow",
  "Bonsai",
] as const

const PROVIDER_GROUP_DESCRIPTIONS = {
  Bonsai: "Higher-capacity models aimed at desktop-class quality.",
  Falcon:
    "TII Falcon H1 tiny instruct and multilingual instruct for edge-friendly chat.",
  Gemma: "Google's open Gemma checkpoints for chat and text generation.",
  LFM: "Liquid AI LFM models tuned for efficient in-browser inference.",
  Llama: "Meta Llama open-weight instruct models for assistant-style chat.",
  Qwen: "Alibaba Qwen compact models with strong multilingual coverage.",
  SmolLM: "Light Hugging Face instruction models for fast on-device replies.",
  TinySwallow:
    "Swallow-family instruct models with Japanese and English support.",
} as const satisfies Record<(typeof PROVIDER_GROUP_ORDER)[number], string>

export function getProviderGroupDescription(providerGroup: string): string {
  if (providerGroup in PROVIDER_GROUP_DESCRIPTIONS) {
    return PROVIDER_GROUP_DESCRIPTIONS[
      providerGroup as keyof typeof PROVIDER_GROUP_DESCRIPTIONS
    ]
  }
  return ""
}

export function getModelProviderGroup(id: ChatModelId): string {
  switch (id) {
    case "bonsai-1.7b":
      return "Bonsai"
    case "falcon-h1-tiny-90m-instruct":
    case "falcon-h1-tiny-multilingual-100m-instruct":
      return "Falcon"
    case "gemma-3-1b-it":
    case "gemma-3-270m-it":
      return "Gemma"
    case "lfm2-1.2b":
    case "lfm2-350m":
    case "lfm2-5-350m":
    case "lfm2-700m":
      return "LFM"
    case "llama-3.2-1b-instruct":
      return "Llama"
    case "qwen2.5-0.5b":
    case "qwen3-0.6b":
      return "Qwen"
    case "smollm2-135m":
    case "smollm2-360m":
      return "SmolLM"
    case "tinyswallow-1.5b-instruct":
      return "TinySwallow"
  }
}

export function groupChatModelsByProvider(
  models: ChatModelOption[]
): Array<{ providerGroup: string; models: ChatModelOption[] }> {
  const buckets = new Map<string, ChatModelOption[]>()
  for (const model of models) {
    const list = buckets.get(model.providerGroup)
    if (list) {
      list.push(model)
    } else {
      buckets.set(model.providerGroup, [model])
    }
  }

  const ordered: Array<{ providerGroup: string; models: ChatModelOption[] }> =
    []
  for (const name of PROVIDER_GROUP_ORDER) {
    const groupModels = buckets.get(name)
    if (groupModels?.length) {
      ordered.push({ providerGroup: name, models: groupModels })
    }
  }
  for (const [providerGroup, groupModels] of buckets) {
    if (
      !(PROVIDER_GROUP_ORDER as readonly string[]).includes(providerGroup) &&
      groupModels.length > 0
    ) {
      ordered.push({ providerGroup, models: groupModels })
    }
  }
  return ordered
}

export function getModelOptions(
  profile: DeviceProfile
): Array<ChatModelOption> {
  return Object.values(CHAT_MODELS).map((model) => ({
    description:
      profile === "constrained" && !model.supportsMobile
        ? `${model.description} Desktop only.`
        : model.description,
    disabled: profile === "constrained" && !model.supportsMobile,
    id: model.id,
    label: model.label,
    providerGroup: getModelProviderGroup(model.id),
    shortLabel: model.shortLabel,
    supportsDesktop: model.supportsDesktop,
    supportsMobile: model.supportsMobile,
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
  const isMobileDevice =
    /Android|webOS|BlackBerry|Opera Mini|IEMobile|Mobile/i.test(userAgent) ||
    isIosDevice ||
    isTouchMac
  const isLowMemoryDevice =
    typeof deviceMemory === "number" && deviceMemory <= 4

  return isMobileDevice || isLowMemoryDevice ? "constrained" : "standard"
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

export function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null
  }

  const normalized = Math.max(0, Math.min(100, value))
  return `${Math.round(normalized)}%`
}
