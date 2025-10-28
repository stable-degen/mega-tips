"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useDisconnect } from "wagmi";

import { megaEthTestnet } from "@/lib/chains";
import { truncateAddress } from "@/lib/strings";

const BALANCE_CACHE_PREFIX = "megatip:wallet-balance:";

function getRateLimitDelay(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const retryMatch = /retry in\s+(\d+)\s*seconds?/i.exec(error.message);
  if (retryMatch) {
    const seconds = Number.parseInt(retryMatch[1] ?? "", 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  if (/429|rate limit|compute unit/i.test(error.message)) {
    return 30_000;
  }

  return null;
}

export function WalletPanel() {
  const { address, isConnected } = useAccount();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const [isClient, setIsClient] = useState(false);
  const [cachedBalance, setCachedBalance] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  const {
    data: balance,
    isFetching: isBalanceRefreshing,
    error: balanceError,
  } = useBalance({
    address,
    chainId: megaEthTestnet.id,
    query: {
      enabled: Boolean(address),
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: (failureCount, error) => {
        if (failureCount >= 5) return false;
        if (error instanceof Error && /invalid|not found/i.test(error.message)) {
          return false;
        }
        return true;
      },
      retryDelay: (attemptIndex, error) => {
        const rateLimitDelay = getRateLimitDelay(error);
        if (rateLimitDelay !== null) {
          return rateLimitDelay;
        }
        const baseDelay = 1000 * 2 ** attemptIndex;
        return Math.min(baseDelay, 30_000);
      },
    },
  });

  useEffect(() => {
    if (!isClient) return;

    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCachedBalance(null);
      return;
    }

    const storageKey = `${BALANCE_CACHE_PREFIX}${address.toLowerCase()}`;

    if (balance) {
      const symbol = balance.symbol ?? megaEthTestnet.nativeCurrency.symbol;
      const value = `${balance.formatted} ${symbol}`;
      setCachedBalance(value);
      try {
        window.localStorage.setItem(storageKey, value);
      } catch {
        // Ignore storage write failures (private browsing, etc.).
      }
      return;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        setCachedBalance(stored);
      }
    } catch {
      // Ignore storage read failures (private browsing, etc.).
    }
  }, [address, balance, isClient]);

  const explorerUrl = useMemo(() => {
    if (!address) return undefined;
    const explorerBase =
      megaEthTestnet.blockExplorers?.okx?.url ??
      megaEthTestnet.blockExplorers?.default?.url;

    if (!explorerBase) return undefined;

    return `${explorerBase.replace(/\/$/, "")}/address/${address}`;
  }, [address]);

  const balanceDisplay = useMemo(() => {
    if (!isClient) return "—";

    if (balance) {
      const symbol = balance.symbol ?? megaEthTestnet.nativeCurrency.symbol;
      return `${balance.formatted} ${symbol}`;
    }

    if (isBalanceRefreshing) {
      return "Refreshing...";
    }

    if (cachedBalance) {
      return cachedBalance;
    }

    if (balanceError instanceof Error) {
      if (/429|rate limit|compute unit/i.test(balanceError.message)) {
        return "Rate limited - retrying";
      }
      return "Balance unavailable";
    }

    return "—";
  }, [balance, balanceError, cachedBalance, isBalanceRefreshing, isClient]);

  const hasWalletDetails = Boolean(isClient && isConnected && address);

  return (
    <section className="grid gap-4 rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-slate-200 backdrop-blur">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
            Wallet
          </p>
          <p className="text-base font-semibold text-slate-100">
            {hasWalletDetails && address
              ? truncateAddress(address)
              : "Not connected"}
          </p>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" label="Connect" />
      </header>
      <p className="text-xs leading-5 text-slate-400">
        Connect to MegaETH testnet and we&apos;ll auto-detect your MegaTip contract.
        Once paired, you can fire off tips, watch the live feed, and check
        stats--all without refreshing.
      </p>
      {hasWalletDetails && (
        <div className="grid gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 text-xs text-slate-200">
          <dl className="flex items-baseline justify-between gap-4">
            <div className="space-y-1">
              <dt className="uppercase tracking-[0.2em] text-emerald-300">Balance</dt>
              <dd
                className="text-lg font-semibold text-white"
                data-testid="wallet-balance-value"
              >
                {balanceDisplay}
              </dd>
            </div>
            <button
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-slate-100 transition hover:border-emerald-300/60 hover:text-emerald-200 disabled:opacity-50"
              type="button"
              onClick={() => disconnect?.()}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting" : "Disconnect"}
            </button>
          </dl>
          {explorerUrl && (
            <a
              className="inline-flex items-center gap-2 text-emerald-200 transition hover:text-emerald-100"
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on explorer
              <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}
