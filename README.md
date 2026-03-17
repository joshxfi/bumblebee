# Bumblebee 🐝

Bumblebee is a fully client-side, on-device chat app built with React, Vite, and Transformers.js. It runs local language models in the browser, keeps chat history ephemeral to the current tab, and avoids any application backend, account system, or server-side inference layer.

This project is primarily for educational and experimental purposes: a small reference app for exploring local-first browser AI, web workers, streaming UI, and lightweight in-browser inference.

Live demo: [bumblebee.joshxfi.com](https://bumblebee.joshxfi.com)

## What It Does

- Runs text generation in a dedicated Web Worker so inference does not block the UI thread
- Uses browser-based on-device models fetched at runtime from Hugging Face
- Defaults constrained devices to a smaller model for stability
- Supports model selection in the UI
- Streams markdown responses with Streamdown
- Keeps the transcript ephemeral in memory only
- Reuses browser-managed cache for model assets on repeat visits

## How It Works

- `React + Vite` powers the app shell and chat UI
- `Transformers.js` runs the selected ONNX model in the browser
- A dedicated `Web Worker` owns model loading and generation

Model assets are not bundled into the app. They are fetched from Hugging Face at runtime, then cached by the browser when possible.

## Current Models

- `LFM2 350M`
  Desktop-recommended model for richer and longer replies
- `SmolLM2 135M`
  Mobile-safe fallback for constrained or low-memory devices

The app auto-selects the smaller model on constrained devices and disables the heavier desktop model there to reduce crash-prone paths.

## Limitations / Notes

- This project is educational and experimental, not a production-grade AI platform
- First use downloads tokenizer and model assets in the browser
- Browser cache reuse is expected, but cache retention is controlled by the browser
- Low-memory and mobile devices can still be constrained even with the lighter model
- This is browser-based on-device inference, not a private local desktop application
- Response quality and reliability are bounded by the size of the shipped local models

## Local Development

### Prerequisites

- [Bun](https://bun.sh/)

### Setup

```bash
bun install
bun run dev
```

### Useful Commands

```bash
bun run build
bun run test
bun run lint
bun run typecheck
```

## Project Structure

- [`src/chat-app.tsx`](/Users/joshxfi/projects/open-source/web-llm-inference/src/chat-app.tsx): main chat UI
- [`src/workers/chat.worker.ts`](/Users/joshxfi/projects/open-source/web-llm-inference/src/workers/chat.worker.ts): model loading and generation worker
- [`src/lib/chat-store.ts`](/Users/joshxfi/projects/open-source/web-llm-inference/src/lib/chat-store.ts): Zustand chat/runtime state

## License

This project is licensed under the [MIT License](./LICENSE).
