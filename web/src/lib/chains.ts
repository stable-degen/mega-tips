import { defineChain } from "viem";

const rpcHttp =
  process.env.NEXT_PUBLIC_RPC_HTTP ?? process.env.PUBLIC_RPC_HTTP ??
  "https://carrot.megaeth.com/rpc";

const rpcWs =
  process.env.NEXT_PUBLIC_RPC_WS ?? process.env.PUBLIC_RPC_WS ??
  "wss://carrot.megaeth.com/ws";

export const megaEthTestnet = defineChain({
  id: 6342,
  name: "MegaETH Testnet",
  network: "megaeth-testnet",
  nativeCurrency: {
    name: "MegaETH Testnet Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [rpcHttp],
      webSocket: [rpcWs],
    },
    public: {
      http: [rpcHttp],
      webSocket: [rpcWs],
    },
  },
  blockExplorers: {
    default: { name: "MegaExplorer", url: "https://megaexplorer.xyz" },
    okx: {
      name: "OKX MegaETH Explorer",
      url: "https://www.okx.com/web3/explorer/megaeth-testnet",
    },
  },
  testnet: true,
});

export const megaEthChains = [megaEthTestnet] as const;
