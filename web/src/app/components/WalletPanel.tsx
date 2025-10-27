"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { truncateAddress } from "@/lib/strings";

export function WalletPanel() {
  const { address, isConnected } = useAccount();

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
        Connect to MegaETH testnet and we&apos;ll auto-detect your TipJar config.
        Once paired, you can fire off tips, watch the live feed, and check
        stats--all without refreshing.
      </p>
    </section>
  );
}
