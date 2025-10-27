import { LiveFeed } from "@/app/components/LiveFeed";
import { StatsPanel } from "@/app/components/StatsPanel";
import { TipForm } from "@/app/components/TipForm";
import { WalletPanel } from "@/app/components/WalletPanel";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-20 px-6 py-16 sm:px-12 lg:py-24">
        <section className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">
                MegaTip
              </p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                Collect real-time support from your community.
              </h1>
              <p className="max-w-2xl text-lg text-slate-300">
                Connect your wallet, share your jar, and watch MegaETH tips roll
                in live. Every interaction streams through this dashboard so you
                can celebrate supporters the moment they back you.
              </p>
            </div>

            <WalletPanel />
          </div>

          <StatsPanel />
        </section>

        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] xl:grid-cols-[1.1fr_0.9fr]">
          <TipForm />

          <div className="flex flex-col gap-10">
            <LiveFeed />

            <section className="rounded-3xl border border-white/10 bg-black/40 p-6 text-sm text-slate-300 backdrop-blur">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Share the love
              </h3>
              <p className="mt-3 leading-6">
                Drop MegaTip in your socials, livestream overlays, or
                newsletters. Supporters send small amounts of test MEGA, leave a
                note, and show up instantly in your live feed and stats.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-emerald-200">
                Coming soon: embeddable widgets &amp; intent buttons.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
