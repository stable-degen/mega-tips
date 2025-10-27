## Overview

This Next.js 16 scaffold powers the MegaETH TipJar frontend. It ships with
TypeScript, Tailwind CSS v4, ESLint, and project-specific helpers under
`lib/`. The landing page outlines the upcoming wallet connect, live feed, and
stats modules.

## Getting Started

```bash
pnpm install
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the placeholder UI.
Edit `src/app/page.tsx` or the supporting components to iterate on the layout.

## Project Notes

- Contract ABIs live in `lib/abis` and are exported via `lib/abis/index.ts`.
- Tailwind classes come from v4&apos;s `@tailwindcss/postcss` plugin. Use
  `src/app/globals.css` for design tokens.
- `pnpm lint` runs ESLint with the Next.js config and should stay green before
  committing frontend changes.
- Update `.env.local` with MegaETH values:
  - `NEXT_PUBLIC_RPC_HTTP` / `NEXT_PUBLIC_RPC_WS`
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- Providers live in `src/app/providers.tsx` and wrap wagmi, RainbowKit, and React Query.
