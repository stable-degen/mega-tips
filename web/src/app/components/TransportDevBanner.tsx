"use client";

import { useTransportControls } from "@/lib/transportControls";

export function TransportDevBanner() {
  const { sliderVisible, mode, setMode, sliderFlag } = useTransportControls();

  if (!sliderVisible) {
    return null;
  }

  const isCautious = mode === "cautious";

  const statusCopy = isCautious
    ? "Cautious polling keeps MegaETH under 10 req/min and skips realtime websockets."
    : "Normal streaming enables websockets and standard polling fallback.";

  let defaultLabel = "Hidden";
  if (sliderFlag === "active-default") {
    defaultLabel = "Active by default";
  } else if (sliderFlag === "disabled-default") {
    defaultLabel = "Disabled by default";
  }

  const toggle = () => {
    setMode(isCautious ? "normal" : "cautious");
  };

  return (
    <aside className="sticky top-0 z-10 border-b border-amber-400/20 bg-amber-900/50 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-amber-100 sm:px-12">
        <div className="space-y-1 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-200">
            Realtime Dev Controls
          </p>
          <p className="leading-5 text-amber-50">{statusCopy}</p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300/70">
            {defaultLabel}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isCautious}
          onClick={toggle}
          className="group inline-flex items-center gap-3 rounded-full border border-amber-300/40 bg-amber-950/60 px-4 py-2 text-xs uppercase tracking-[0.3em] transition hover:border-amber-200 hover:text-amber-100"
        >
          <span>{isCautious ? "Cautious" : "Normal"}</span>
          <span
            aria-hidden
            className={`relative inline-flex h-6 w-11 items-center rounded-full border border-amber-200/60 bg-amber-950 px-1 transition-all ${
              isCautious ? "justify-end bg-amber-400/40" : "justify-start bg-amber-800/60"
            }`}
          >
            <span className="inline-block h-5 w-5 rounded-full bg-amber-100 shadow transition-transform" />
          </span>
        </button>
      </div>
    </aside>
  );
}
