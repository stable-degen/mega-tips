import { LiveFeed } from "@/app/components/LiveFeed";
import { TipForm } from "@/app/components/TipForm";
import { WalletPanel } from "@/app/components/WalletPanel";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-16 px-6 py-24 sm:px-12">
        <section className="space-y-6">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">
            MegaETH TipJar
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Collect real-time support from your community.
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            This scaffolded UI is the launch pad for the TipJar dapp. We&apos;ll
            plug in wallet connections, streaming tips, and sharable embeds so
            supporters can boost you on the MegaETH testnet.
          </p>

          <WalletPanel />
        </section>

        <TipForm />

        <LiveFeed />

        <section className="space-y-3 text-sm text-slate-400">
          <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Shareable Embed Goals
          </h3>
          <p>
            Final UI will surface a copy-paste badge so you can link the TipJar
            straight from your socials, blogs, or livestream overlays. Until we
            wire the contract events, use this scaffold to shape copy, visuals,
            and layout.
          </p>
        </section>
      </div>
    </main>
  );
}
