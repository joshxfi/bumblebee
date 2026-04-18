import { useEffect, useId, useRef, useState } from "react"

import { cn } from "@/lib/utils"

function useDocumentClass(className: string) {
  const [active, setActive] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains(className)
      : false
  )

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setActive(root.classList.contains(className))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [className])

  return active
}

/** Stacked vertically so each flow reads clearly on narrow viewports. */
const CHART_TYPICAL_HOSTED = `flowchart TB
  subgraph hosted["Typical hosted chat"]
    direction TB
    HB["Browser UI"] --> AS["App server"]
    AS --> RM["Remote model API"]
  end`

const CHART_BUMBLEBEE_PATH = `flowchart TB
  subgraph bee["Bumblebee"]
    direction TB
    BT["Browser tab"] <--> WW["Web Worker ONNX"]
    WW --> HF["Hugging Face CDN weights"]
  end`

const CHART_RUNTIME = `flowchart TB
  MT["Main thread React / Zustand"] <-->|postMessage| WW["Web Worker Transformers.js"]
  WW -->|HTTPS| HF["Hugging Face ONNX / tokenizer"]`

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const baseId = useId().replace(/:/g, "")
  const isDark = useDocumentClass("dark")
  const nonceRef = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return undefined
    }

    let cancelled = false
    nonceRef.current += 1
    const nonce = nonceRef.current

    void (async () => {
      const mermaid = (await import("mermaid")).default
      mermaid.initialize({
        fontFamily: "inherit",
        securityLevel: "strict",
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        themeVariables: {
          fontSize: "15px",
        },
      })

      if (cancelled) {
        return
      }

      try {
        const { svg, bindFunctions } = await mermaid.render(
          `about-mermaid-${baseId}-${nonce}`,
          chart
        )
        if (cancelled || !containerRef.current) {
          return
        }
        containerRef.current.innerHTML = svg
        bindFunctions?.(containerRef.current)
      } catch {
        if (!cancelled && containerRef.current) {
          containerRef.current.textContent =
            "This diagram could not be rendered."
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [baseId, chart, isDark])

  return (
    <div
      ref={containerRef}
      className={cn(
        "min-h-[9rem] [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:min-h-[min-content]"
      )}
    />
  )
}

/** Hosted SaaS chat vs Bumblebee: where inference runs. */
export function HostedVsLocalDiagram() {
  return (
    <figure className="space-y-3">
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Typical hosted chat
          </p>
          <div className="overflow-x-auto rounded-none border border-border bg-muted/20 p-4 text-muted-foreground">
            <MermaidBlock chart={CHART_TYPICAL_HOSTED} />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Bumblebee
          </p>
          <div className="overflow-x-auto rounded-none border border-border bg-muted/20 p-4 text-muted-foreground">
            <MermaidBlock chart={CHART_BUMBLEBEE_PATH} />
          </div>
        </div>
      </div>
      <figcaption className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
        In a classic product, your words often leave the browser for an
        application backend and a hosted model. Here, generation runs in a
        worker inside your tab; the network is used like a CDN to fetch model
        artifacts, not to send prompts to a Bumblebee-owned API.
      </figcaption>
    </figure>
  )
}

/** Main thread, worker, and Hugging Face in the Bumblebee runtime. */
export function RuntimeArchitectureDiagram() {
  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-none border border-border bg-muted/20 p-4 text-muted-foreground">
        <MermaidBlock chart={CHART_RUNTIME} />
      </div>
      <figcaption className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
        The UI thread stays responsive while the worker owns the heavy model.
        Weights are not bundled: first load pulls them over HTTPS, then the
        browser cache can reuse them.
      </figcaption>
    </figure>
  )
}
