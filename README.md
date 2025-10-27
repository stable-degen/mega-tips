# TipJar

TipJar is a lightweight MegaETH testnet dapp for on-chain tipping. The repo will house a Foundry-based `TipJar.sol` contract, deployment scripts, tests, and a Next.js frontend that streams `Tipped` events in real time.

## 2-Day Build Focus
- Day 1: implement and test the contract, deploy to MegaETH testnet, scaffold Next.js with wallet connect and tipping flow.
- Day 2: wire up WebSocket tip streaming, live stats panels, UI polish, env wiring, and prep for launch/announcement.

Additional docs, contract code, and frontend modules will be added as milestones in the outline are completed.

## Environment Setup
- Copy `.env.example` to `.env.local` (or `.env`) and fill in MegaETH RPC endpoints, chain ID, and the deployed `TipJar` address once available.
- Provide both `PUBLIC_RPC_*` (for scripts) and `NEXT_PUBLIC_RPC_*` (for the frontend) so wagmi and RainbowKit can reach MegaETH.
- Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` when you create a WalletConnect Cloud project; the app falls back to a shared demo ID for local smoke testing.
- Reuse the provided `ETH_ACCOUNT_ADDRESS` for local scripts; never commit real private keys.
- Foundry scripts expect `FOUNDRY_RPC_URL` and `FOUNDRY_PRIVATE_KEY` to be populated before broadcasting deployments.
