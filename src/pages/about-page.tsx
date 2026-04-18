import type { ReactNode } from "react"
import { ArrowLeftIcon, FlaskIcon } from "@phosphor-icons/react"
import { Link } from "react-router-dom"

import {
  HostedVsLocalDiagram,
  RuntimeArchitectureDiagram,
} from "@/components/about/architecture-diagrams"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import {
  DEFAULT_MODEL_ID,
  getModelConfig,
  getRecommendedModelId,
} from "@/lib/chat-config"
import { PROJECT_AUTHOR, PROJECT_REPO_URL } from "@/lib/site-meta"
import { cn } from "@/lib/utils"

function Section({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {title}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem] sm:leading-relaxed [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  )
}

export default function AboutPage() {
  const constrainedId = getRecommendedModelId("constrained")
  const standardModel = getModelConfig(DEFAULT_MODEL_ID)
  const constrainedModel = getModelConfig(constrainedId)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-3 sm:px-4">
          <Link
            className={cn(
              buttonVariants({
                className: "gap-1.5 border-border bg-card hover:bg-accent",
                size: "sm",
                variant: "outline",
              })
            )}
            to="/"
          >
            <ArrowLeftIcon aria-hidden className="size-3.5" weight="bold" />
            Back to chat
          </Link>
          <h1 className="truncate text-base font-medium text-foreground">
            About
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-3 pb-16 pt-24 sm:px-4">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground sm:text-lg">
            Bumblebee
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
            A small open-source reference app for running ONNX chat models
            entirely in your browser with React, Vite, and{" "}
            <span className="text-foreground">@huggingface/transformers</span>.
            There is no companion server for this UI: model files are loaded
            from Hugging Face like static assets, and inference runs on your
            device.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
            This project is{" "}
            <a
              className="text-foreground underline decoration-border underline-offset-2 hover:decoration-primary"
              href={PROJECT_REPO_URL}
              rel="noreferrer noopener"
              target="_blank"
            >
              open source on GitHub
            </a>
            . Built by{" "}
            <a
              className="text-foreground underline decoration-border underline-offset-2 hover:decoration-primary"
              href={PROJECT_AUTHOR.profileUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              {PROJECT_AUTHOR.handle}
            </a>
            .
          </p>
        </div>

        <Alert className="border-primary/35 bg-primary/5 px-3 py-3 text-sm sm:text-[0.9375rem]">
          <FlaskIcon aria-hidden className="text-primary" weight="duotone" />
          <AlertTitle className="text-sm font-semibold sm:text-base">
            Experimental · for learning only
          </AlertTitle>
          <AlertDescription className="text-sm leading-relaxed sm:text-[0.9375rem]">
            Bumblebee is <strong>not</strong> a production AI product. It exists
            for <strong>education and experimentation</strong>. Outputs may be
            wrong, unsafe, or inconsistent; there are no warranties. Do not rely
            on it for medical, legal, financial, or other high-stakes decisions.
          </AlertDescription>
        </Alert>

        <Section title="Where your messages go">
          <p>
            This app does <strong>not</strong> send your conversation to a
            Bumblebee-operated inference API. Text you type stays in the tab for
            orchestration, while the selected model runs inside a{" "}
            <strong>Web Worker</strong> in your browser.
          </p>
          <p>
            The only routine network use is downloading tokenizer and weight
            files from <strong>Hugging Face</strong> (public HTTPS endpoints),
            similar to loading a large library from a CDN. Hugging Face can see
            those HTTP requests; this is not an air-gapped or fully offline
            desktop runtime unless you control networking separately.
          </p>
          <HostedVsLocalDiagram />
        </Section>

        <Section title="How it works">
          <ul className="list-inside list-disc space-y-2.5 marker:text-muted-foreground">
            <li>
              <strong>Main thread</strong> — React UI, keyboard focus, and
              markdown rendering (Streamdown). Chat state lives in a Zustand
              store.
            </li>
            <li>
              <strong>Web Worker</strong> — Loads the ONNX model with{" "}
              <code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground sm:text-[0.8125rem]">
                @huggingface/transformers
              </code>{" "}
              and runs token generation off the UI thread.
            </li>
            <li>
              <strong>Runtime bridge</strong> — The main thread and worker
              exchange lifecycle and streaming events over{" "}
              <code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground sm:text-[0.8125rem]">
                postMessage
              </code>
              .
            </li>
            <li>
              <strong>Ephemeral transcript</strong> — Messages are kept in memory
              for the session; refreshing or closing the tab clears them.
            </li>
          </ul>
          <RuntimeArchitectureDiagram />
        </Section>

        <Section title="Device profiles and defaults">
          <p>
            Bumblebee estimates whether your environment is{" "}
            <strong>standard</strong> (desktop-class) or{" "}
            <strong>constrained</strong> (typical phones, touch Macs treated as
            mobile-like, or low reported device memory) and picks a starting
            model accordingly. Models that are not marked mobile-capable are
            disabled on constrained profiles to reduce unstable loads.
          </p>
          <p>
            Current defaults: <strong>{standardModel.label}</strong> on
            standard devices, <strong>{constrainedModel.label}</strong> on
            constrained devices. Full labels and Hugging Face repo IDs live in{" "}
            <code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground sm:text-[0.8125rem]">
              src/lib/chat-config.ts
            </code>{" "}
            and the project README.
          </p>
        </Section>
      </main>
    </div>
  )
}
