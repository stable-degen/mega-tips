"use client";

import "@rainbow-me/rainbowkit/styles.css";

type GlobalWithIndexedDB = typeof globalThis & { indexedDB?: unknown };

const globalWithIndexedDb = globalThis as GlobalWithIndexedDB;

if (typeof window === "undefined" && typeof globalWithIndexedDb.indexedDB === "undefined") {
  const polyfill = {
    open: () => ({}) as IDBOpenDBRequest,
    deleteDatabase: () => ({}) as IDBOpenDBRequest,
    databases: async () => [],
    cmp: () => 0,
  } as unknown as IDBFactory;

  Object.defineProperty(globalWithIndexedDb, "indexedDB", {
    value: polyfill,
    writable: true,
  });
}

import { ReactNode, useMemo, useState } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { megaEthTestnet } from "@/lib/chains";
import { TransportControlsProvider } from "@/lib/transportControls";
import { createQueryClient, createWagmiConfig } from "@/lib/wagmi";

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  const wagmiConfig = useMemo(() => createWagmiConfig(), []);
  const theme = useMemo(
    () =>
      darkTheme({
        accentColor: "#34d399",
        borderRadius: "medium",
      }),
    [],
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TransportControlsProvider>
          <RainbowKitProvider
            modalSize="compact"
            initialChain={megaEthTestnet}
            theme={theme}
            appInfo={{
              appName: "MegaTip",
            }}
          >
            {children}
          </RainbowKitProvider>
        </TransportControlsProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
