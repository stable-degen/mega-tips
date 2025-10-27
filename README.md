# TipJar

TipJar is a MegaETH testnet dapp that lets creators drop a lightweight tip jar anywhere they share a link. Fans can connect a wallet, send a note with their tip, and watch it appear instantly in a live activity feed.

## Features
- **On-chain tips** powered by the `TipJar.sol` contract (Solidity 0.8.x, deployed with Foundry)
- **Real-time activity feed** using MegaETH’s websocket RPC plus a polling fallback
- **Wallet-friendly UX** via Next.js, wagmi, and RainbowKit with WalletConnect support
- **Live stats** showing total tips, unique supporters, and the biggest shoutouts

## Tech Stack
- Smart contracts: Foundry (forge/cast), Solidity 0.8.24
- Frontend: Next.js (App Router), TypeScript, wagmi, RainbowKit, viem
- Tooling: pnpm, Vitest, Playwright (planned), GitHub Actions CI

## Quick Start
```bash
pnpm install --dir web
pnpm --dir web dev               # start Next.js at http://localhost:3000
```

Before running the app, review `.env.example` and provide the MegaETH RPC URLs, chain ID, WalletConnect project ID, and TipJar contract address using your preferred environment management (shell exports, direnv, or a private `.env` file kept outside version control).

To run the smart-contract test suite:
```bash
~/.foundry/bin/forge install      # first-time only, pulls dependencies
~/.foundry/bin/forge test
```

## Deploying the Contract
1. Export `OWNER_ADDRESS`, `FOUNDRY_RPC_URL`, and deployment credentials in your shell session (or preferred secrets manager).
2. Connect the Trezor that controls the MegaETH deployer account.
3. Broadcast with Foundry:
   ```bash
   OWNER_ADDRESS=0xYourOwner \
   ~/.foundry/bin/forge script script/Deploy.s.sol:DeployTipJar \
     --rpc-url https://carrot.megaeth.com/rpc \
     --chain 6342 \
     --sender 0xYourDeployer \
     --trezor \
     --mnemonic-derivation-paths "m/44'/60'/0'/0/1" \
     --broadcast
   ```
4. After confirmation, update your frontend environment variables with the new contract address (`NEXT_PUBLIC_TIPJAR_ADDRESS`).

> **Heads up:** The public MegaETH faucet is throttled while the network onboards builders. If the faucet UI says “success” but your account still reads 0 MEGA on [OKX MegaETH Explorer](https://www.okx.com/web3/explorer/megaeth-testnet), ping the MegaETH Discord for a manual top-up before redeploying.

## Frontend Development
- Main entry point: `web/src/app/page.tsx`
- Components: `web/src/app/components/`
- Hooks & chain config: `web/src/lib/`
- Tests: `web/src/**/__tests__/*.test.tsx` (Vitest)

Useful commands:
- `pnpm --dir web lint` – TypeScript + ESLint
- `pnpm --dir web test` – Vitest unit tests (React Testing Library)
- `pnpm --dir web build` – production bundle check

## Contract Package
- Source: `contracts/TipJar.sol`
- Tests: `test/TipJar.t.sol`
- Deployment script: `script/Deploy.s.sol`

Run `forge coverage` or `forge test -vvvv` when you need deeper instrumentation.

## Deployment Status
- **Contract:** Pending redeploy (awaiting fresh MegaETH faucet funding)
- **Frontend:** Local development build available; production deployment steps documented but not yet executed

## License
This project is released under the MIT License. See `LICENSE` for details.
