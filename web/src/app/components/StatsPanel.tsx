"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";

import { megaEthTestnet } from "@/lib/chains";
import { useTipStream } from "@/lib/hooks";

const REFRESH_INTERVAL_MS = 30_000;
const WINDOW_MINUTES = 10;

type StreamStatus = ReturnType<typeof useTipStream>["status"];

const statusMeta: Record<StreamStatus, { label: string; tone: string }> = {
  idle: { label: "Idle", tone: "bg-slate-500" },
  connecting: { label: "Connecting", tone: "bg-amber-400" },
  connected: { label: "Live", tone: "bg-emerald-400" },
  polling: { label: "Polling", tone: "bg-sky-400" },
  error: { label: "Offline", tone: "bg-rose-500" },
};

type MetricSnapshot = {
  totalVolume: string;
  uniqueTippers: string;
  largestTip: string;
  tipsPerMinute: string;
};

function formatEth(valueWei: bigint, formatter: Intl.NumberFormat) {
  const parsed = Number.parseFloat(formatEther(valueWei));
  if (!Number.isFinite(parsed)) {
    return formatEther(valueWei);
  }
  return formatter.format(parsed);
}

function computeMetrics(
  nowMs: number,
  windowMinutes: number,
  options: {
    tips: ReturnType<typeof useTipStream>["tips"];
    amountFormatter: Intl.NumberFormat;
    countFormatter: Intl.NumberFormat;
    rateFormatter: Intl.NumberFormat;
  },
): MetricSnapshot {
  const { tips, amountFormatter, countFormatter, rateFormatter } = options;

  if (!tips.length) {
    return {
      totalVolume: amountFormatter.format(0),
      uniqueTippers: countFormatter.format(0),
      largestTip: amountFormatter.format(0),
      tipsPerMinute: rateFormatter.format(0),
    };
  }

  const zero = BigInt(0);
  const totalWei = tips.reduce<bigint>((acc, tip) => acc + tip.amountWei, zero);
  const unique = new Set(tips.map((tip) => tip.from.toLowerCase())).size;
  const largestWei = tips.reduce<bigint>(
    (acc, tip) => (tip.amountWei > acc ? tip.amountWei : acc),
    zero,
  );

  const windowMs = windowMinutes * 60_000;
  const threshold = nowMs - windowMs;

  const tipsInWindow = tips.filter(
    (tip) => tip.timestamp * 1000 >= threshold,
  );

  let rate = 0;
  if (tipsInWindow.length > 0) {
    const oldestMs = tipsInWindow.reduce<number>((min, tip) => {
      const tsMs = tip.timestamp * 1000;
      return tsMs < min ? tsMs : min;
    }, nowMs);

    const elapsedMs = Math.max(60_000, Math.min(windowMs, nowMs - oldestMs));
    rate = tipsInWindow.length / (elapsedMs / 60_000);
  }

  return {
    totalVolume: formatEth(totalWei, amountFormatter),
    uniqueTippers: countFormatter.format(unique),
    largestTip: formatEth(largestWei, amountFormatter),
    tipsPerMinute: rateFormatter.format(rate),
  };
}

export function StatsPanel() {
  const tipStream = useTipStream();
  const { tips, status } = tipStream;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 6,
      }),
    [],
  );

  const countFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumIntegerDigits: 1,
      }),
    [],
  );

  const rateFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const metrics = useMemo(
    () =>
      computeMetrics(nowMs, WINDOW_MINUTES, {
        tips,
        amountFormatter,
        countFormatter,
        rateFormatter,
      }),
    [amountFormatter, countFormatter, nowMs, rateFormatter, tips],
  );

  const statusInfo = statusMeta[status as StreamStatus] ?? statusMeta.idle;

  const entries: Array<{
    label: string;
    value: string;
    suffix?: string;
    helper?: string;
  }> = [
    {
      label: "Total Volume",
      value: metrics.totalVolume,
      suffix: megaEthTestnet.nativeCurrency.symbol,
    },
    {
      label: "Unique Tippers",
      value: metrics.uniqueTippers,
    },
    {
      label: "Largest Tip",
      value: metrics.largestTip,
      suffix: megaEthTestnet.nativeCurrency.symbol,
    },
    {
      label: "Tips / Min",
      value: metrics.tipsPerMinute,
      helper: `Last ${WINDOW_MINUTES} min window`,
    },
  ];

  return (
    <section className="grid gap-6 rounded-3xl border border-white/10 bg-black/40 p-6 text-sm text-slate-200 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
            Tip Activity
          </p>
          <p className="text-base text-slate-300">
            Snapshot of live tipping metrics pulled from MegaETH events.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
          <span
            aria-hidden
            className={`h-2.5 w-2.5 rounded-full ${statusInfo.tone}`}
          />
          <span className="text-slate-300">{statusInfo.label}</span>
        </div>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        {entries.map(({ label, value, suffix, helper }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-black/30"
          >
            <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              {label}
            </dt>
            <dd className="mt-3 flex items-baseline gap-2 text-2xl font-semibold text-emerald-200">
              <span>{value}</span>
              {suffix && (
                <span className="text-sm font-medium text-emerald-300">
                  {suffix}
                </span>
              )}
            </dd>
            {helper && (
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {helper}
              </p>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
