export const CHAT_MODEL_CONFIG = {
  modelId: "onnx-community/LFM2-350M-ONNX",
  label: "LFM2 350M",
  dtype: "q4",
  generation: {
    do_sample: true,
    max_new_tokens: 88,
    repetition_penalty: 1.08,
    return_full_text: false,
    temperature: 0.72,
    top_p: 0.92,
  },
} as const

export const CHAT_COPY = {
  subtitle:
    "On-device replies with no account, no backend, and no saved transcript.",
  warmup:
    "First run downloads the tokenizer and weights from Hugging Face, then the browser cache handles the repeat visits.",
  footnote:
    "Mobile-first baseline uses WASM/CPU and opportunistically upgrades to WebGPU when the browser exposes it.",
} as const

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
