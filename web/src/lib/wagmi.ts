import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient } from "@tanstack/react-query";

import { megaEthChains, megaEthTestnet } from "@/lib/chains";

const appName = "MegaTip";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  process.env.WALLETCONNECT_PROJECT_ID ??
  "";

const rpcHttp =
  process.env.NEXT_PUBLIC_RPC_HTTP ??
  process.env.PUBLIC_RPC_HTTP ??
  "https://carrot.megaeth.com/rpc";

export const createWagmiConfig = () =>
  getDefaultConfig({
    appName,
    projectId: walletConnectProjectId || "demo",
    ssr: false,
    chains: megaEthChains,
    transports: {
      [megaEthTestnet.id]: http(rpcHttp),
    },
  });

export const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } });
