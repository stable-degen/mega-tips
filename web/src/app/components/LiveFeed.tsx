"use client";

import { useEffect, useMemo, useState } from "react";

import { megaEthTestnet } from "@/lib/chains";
import { useTipStream } from "@/lib/hooks";
import type { UseTipStreamState } from "@/lib/hooks";
import { truncateAddress } from "@/lib/strings";

const REFRESH_INTERVAL_MS = 15_000;
const DEFAULT_FEED_LIMIT = 30;

type LiveFeedProps = {
  maxItems?: number;
};

function formatTimeAgo(timestampSeconds: number | undefined, nowMs: number) {
  if (!timestampSeconds) return "Unknown";

  const diffSeconds = Math.max(
    0,
    Math.floor((nowMs - timestampSeconds * 1000) / 1000),
  );

  if (diffSeconds < 5) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type StreamStatus = UseTipStreamState["status"];

const statusMap: Record<StreamStatus, { label: string; tone: string }> = {
  idle: { label: "Idle", tone: "bg-slate-500" },
  connecting: { label: "Connecting", tone: "bg-amber-400" },
  connected: { label: "Live", tone: "bg-emerald-400" },
  polling: { label: "Polling", tone: "bg-sky-400" },
  error: { label: "Offline", tone: "bg-rose-500" },
};

export function LiveFeed({ maxItems = DEFAULT_FEED_LIMIT }: LiveFeedProps) {
  const { tips, status, error, reconnect } = useTipStream();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const explorerTxBase = useMemo(() => {
    const base =
      megaEthTestnet.blockExplorers?.okx?.url ??
      megaEthTestnet.blockExplorers?.default?.url ??
      null;

    if (!base) return null;
    return `${base.replace(/\/$/, "")}/tx`;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(id);
    };
  }, []);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 6,
      }),
    [],
  );

  const entries = useMemo(
    () => tips.slice(0, Math.max(0, maxItems)),
    [tips, maxItems],
  );

  const statusMeta = statusMap[status as StreamStatus] ?? statusMap.idle;

  return (
    <section className="grid gap-5 rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-slate-200 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
            Live Feed
          </p>
          <p className="text-base text-slate-300">
            Watch MegaETH tips stream in without refreshing.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
          <span
            aria-hidden
            className={`h-2.5 w-2.5 rounded-full ${statusMeta.tone}`}
          />
          <span className="text-slate-300">{statusMeta.label}</span>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-100"
        >
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={reconnect}
            className="rounded-full border border-rose-200/60 px-4 py-1.5 text-rose-50 transition hover:border-rose-100 hover:text-white"
          >
            Retry connection
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-center text-xs text-slate-300">
          Tips will appear the moment someone contributes. Share your MegaTip
          link to kickstart the stream.
        </div>
      ) : (
        <ul className="grid gap-3" data-testid="tip-feed">
          {entries.map((tip) => (
            <li
              key={tip.id}
              className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-black/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-mono text-xs text-slate-300">
                    {truncateAddress(tip.from)}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                    {formatTimeAgo(tip.timestamp, nowMs)}
                  </p>
                </div>
                <div className="text-right">
                  {(() => {
                    const parsed = Number.parseFloat(tip.amountEth ?? "0");
                    const display = Number.isFinite(parsed)
                      ? formatter.format(parsed)
                      : tip.amountEth;

                    return (
                      <p className="text-lg font-semibold text-emerald-300">
                        {display}
                        &nbsp;
                        {megaEthTestnet.nativeCurrency.symbol}
                      </p>
                    );
                  })()}
                  {tip.txHash !== "0x" && explorerTxBase && (
                    <a
                      className="text-[11px] uppercase tracking-[0.3em] text-emerald-200 transition hover:text-emerald-100"
                      href={`${explorerTxBase}/${tip.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View tx ↗
                    </a>
                  )}
                </div>
              </div>
              {tip.note && (
                <p className="mt-3 text-sm text-slate-100" data-testid="tip-note">
                  {tip.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
