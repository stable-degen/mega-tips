const placeholderTips = [
  "Connect your wallet to tip in seconds.",
  "Live event stream will pop here once we wire MegaETH realtime.",
  "Stats panel will highlight top supporters and total volume.",
];

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

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled
              className="rounded-full bg-emerald-500/70 px-6 py-3 text-sm font-medium uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              connect wallet (coming soon)
            </button>
            <span className="text-xs text-slate-400">
              Tip flow, live feed, and stats are on the upcoming sprint.
            </span>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Up Next
          </h2>
          <ul className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
            {placeholderTips.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

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
