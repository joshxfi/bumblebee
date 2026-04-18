# Bumblebee 🐝

Bumblebee is a fully client-side chat app: React, Vite, and [`@huggingface/transformers`](https://www.npmjs.com/package/@huggingface/transformers) run ONNX language models in the browser. There is no app backend, account system, or server-side inference—only Hugging Face as the CDN for model weights. Chat history stays in memory for the current tab.

Use it as a small reference for local-first browser AI, Web Workers, streaming UI, and lightweight on-device generation.

![bumblebee](https://github.com/user-attachments/assets/9025fcfa-2263-4091-8044-2c71a4e02260)

Live demo: [bumblebee.joshxfi.com](https://bumblebee.joshxfi.com)

**Source:** [Open source on GitHub](https://github.com/joshxfi/bumblebee) · **Author:** [@joshxfi](https://github.com/joshxfi)

## What It Does

- Runs text generation in a **Web Worker** so inference does not block the UI thread
- Loads **ONNX checkpoints** from Hugging Face at runtime; the browser cache speeds repeat visits
- **Model picker** with models grouped by provider family
- Picks a **device profile** (`standard` vs `constrained`): constrained users get a lighter default, and models marked desktop-only are **disabled** in the UI to avoid unstable loads
- Streams assistant output as **markdown** (Streamdown)
- Keeps the transcript **ephemeral** (in-memory only for the session)

## How It Works

- **React 19** and **Vite** power the shell and chat UI
- **Zustand** holds chat and runtime state; **Tailwind CSS** styles the UI
- **`@huggingface/transformers`** loads the selected repo via `pipeline("text-generation", …)` inside the worker

Weights and tokenizers are not bundled; they download on demand from Hugging Face, then reuse the browser cache when possible.

## Defaults

Bumblebee picks the starting model from [`getRecommendedModelId`](src/lib/chat-config.ts) and [`getDeviceProfile`](src/lib/chat-config.ts). Constrained mode is used on typical mobile user agents, touch-capable Macs counted as touch-first, or when `navigator.deviceMemory` is available and **≤ 4 GB**.

- **Standard (desktop-class) default:** [LFM2.5 350M](https://huggingface.co/onnx-community/LFM2.5-350M-ONNX) — `onnx-community/LFM2.5-350M-ONNX`
- **Constrained default:** [Falcon H1 Tiny 90M Instruct](https://huggingface.co/onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX) — `onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX`

## Model catalog

All checkpoints below are **q4** ONNX builds from the [`onnx-community`](https://huggingface.co/onnx-community) org. **Desktop only** means `supportsMobile: false` in config—those entries are disabled when the device profile is constrained.

### SmolLM

- **SmolLM2 135M** — `onnx-community/SmolLM2-135M-Instruct-ONNX-MHA` — mobile + desktop
- **SmolLM2 360M** — `onnx-community/SmolLM2-360M-ONNX` — mobile + desktop

### Gemma

- **Gemma 3 270M** — `onnx-community/gemma-3-270m-it-ONNX` — mobile + desktop
- **Gemma 3 1B** — `onnx-community/gemma-3-1b-it-ONNX` — desktop only

### Qwen

- **Qwen2.5 0.5B** — `onnx-community/Qwen2.5-0.5B-Instruct-ONNX-MHA` — mobile + desktop
- **Qwen3 0.6B** — `onnx-community/Qwen3-0.6B-ONNX` — mobile + desktop

### Falcon

- **Falcon H1 Tiny 90M** — `onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX` — mobile + desktop
- **Falcon H1 Tiny Multilingual 100M** — `onnx-community/Falcon-H1-Tiny-Multilingual-100M-Instruct-ONNX` — mobile + desktop

### LFM (Liquid)

- **LFM2.5 350M** — `onnx-community/LFM2.5-350M-ONNX` — mobile + desktop
- **LFM2 350M** — `onnx-community/LFM2-350M-ONNX` — mobile + desktop
- **LFM2 700M** — `onnx-community/LFM2-700M-ONNX` — desktop only
- **LFM2 1.2B** — `onnx-community/LFM2-1.2B-ONNX` — desktop only

### Llama

- **Llama 3.2 1B** — `onnx-community/Llama-3.2-1B-Instruct-ONNX` — desktop only

### TinySwallow

- **TinySwallow 1.5B** — `onnx-community/TinySwallow-1.5B-Instruct-ONNX` — desktop only

### Bonsai

- **Bonsai 1.7B** — `onnx-community/Bonsai-1.7B-ONNX` — desktop only

## Limitations

- Educational and experimental—not a production AI platform
- First run downloads tokenizer and weights; later visits depend on browser cache behavior
- Very low-memory hardware can still struggle even with small models
- Browser-based inference is not the same as a fully offline native desktop runtime
- Quality and coherence are limited by model size and quantization

## Local development

### Prerequisites

- [Bun](https://bun.sh/)

### Setup

```bash
bun install
bun run dev
```

### Useful commands

```bash
bun run build
bun run test
bun run lint
bun run typecheck
bun run preview   # local preview of production build
```

## Project structure

- [`src/chat-app.tsx`](src/chat-app.tsx) — main chat UI
- [`src/workers/chat.worker.ts`](src/workers/chat.worker.ts) — model load and generation in a worker
- [`src/lib/chat-store.ts`](src/lib/chat-store.ts) — Zustand store and message/runtime orchestration
- [`src/lib/chat-config.ts`](src/lib/chat-config.ts) — model catalog, defaults, device profile, generation presets

## License

This project is licensed under the [MIT License](./LICENSE).
