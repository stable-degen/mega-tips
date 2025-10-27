"use client";

import { useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useDisconnect } from "wagmi";

import { megaEthTestnet } from "@/lib/chains";
import { truncateAddress } from "@/lib/strings";

export function WalletPanel() {
  const { address, isConnected } = useAccount();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const {
    data: balance,
    isFetching: isBalanceRefreshing,
  } = useBalance({
    address,
    chainId: megaEthTestnet.id,
    query: {
      enabled: Boolean(address),
      refetchOnWindowFocus: true,
    },
  });

  const explorerUrl = useMemo(() => {
    if (!address) return undefined;
    const explorerBase =
      megaEthTestnet.blockExplorers?.okx?.url ??
      megaEthTestnet.blockExplorers?.default?.url;

    if (!explorerBase) return undefined;

    return `${explorerBase.replace(/\/$/, "")}/address/${address}`;
  }, [address]);

  return (
    <section className="grid gap-4 rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-slate-200 backdrop-blur">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
            Wallet
          </p>
          <p className="text-base font-semibold text-slate-100">
            {isConnected && address
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
      {isConnected && (
        <div className="grid gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 text-xs text-slate-200">
          <dl className="flex items-baseline justify-between gap-4">
            <div className="space-y-1">
              <dt className="uppercase tracking-[0.2em] text-emerald-300">Balance</dt>
              <dd
                className="text-lg font-semibold text-white"
                data-testid="wallet-balance-value"
              >
                {balance
                  ? `${balance.formatted} ${balance.symbol ?? megaEthTestnet.nativeCurrency.symbol}`
                  : isBalanceRefreshing
                    ? "Refreshing..."
                    : "0"}
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
