import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";

import { tipJarAbi } from "@/lib/abis/TipJar";
import { useTipStream } from "../useTipStream";
import { TransportControlsProvider } from "@/lib/transportControls";

type MockMessageEvent = {
  data: string;
};

const contractAddress = "0x2222222222222222222222222222222222222222" as const;

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public sentMessages: string[] = [];

  public onopen: ((event: Event) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MockMessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string) {
    this.sentMessages.push(payload);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

const originalWebSocket = globalThis.WebSocket;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_TIPJAR_ADDRESS = contractAddress;
  process.env.NEXT_PUBLIC_REALTIME_WS = "wss://example.megastream";
  process.env.NEXT_PUBLIC_RPC_HTTP = "https://example-rpc";
  vi.useFakeTimers();
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = MockWebSocket as unknown as typeof WebSocket;
  globalThis.fetch = vi.fn();
  MockWebSocket.instances = [];
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
  globalThis.fetch = originalFetch;
  delete process.env.NEXT_PUBLIC_REALTIME_WS;
  delete process.env.NEXT_PUBLIC_RPC_HTTP;
  delete process.env.NEXT_PUBLIC_TRANSPORT_SLIDER_MODE;
  MockWebSocket.instances = [];
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

function emitWsMessage(data: unknown) {
  const instance = MockWebSocket.instances.at(-1);
  if (!instance || !instance.onmessage) throw new Error("WebSocket not initialised");
  instance.onmessage({ data: JSON.stringify(data) });
}

function buildLog({
  from,
  amount,
  note,
  timestamp,
  blockNumber,
  txHash,
  logIndex,
}: {
  from: `0x${string}`;
  amount: bigint;
  note: string;
  timestamp: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: bigint;
}) {
  const topics = encodeEventTopics({
    abi: tipJarAbi,
    eventName: "Tipped",
    args: { from },
  }) as Hex[];

  const data = encodeAbiParameters(
    [
      { name: "amount", type: "uint256" },
      { name: "note", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
    [amount, note, timestamp],
  );

  return {
    address: contractAddress,
    data,
    topics,
    blockNumber: `0x${blockNumber.toString(16)}`,
    transactionHash: txHash,
    logIndex: `0x${logIndex.toString(16)}`,
  };
}

describe("useTipStream", () => {
  it("captures tips emitted via websocket", async () => {
    const amount = 123456789n;
    const timestamp = 1234n;

    const { result } = renderHook(() =>
      useTipStream({ contractAddress, pollingIntervalMs: 5000 }),
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    const instance = MockWebSocket.instances[0];

    act(() => {
      instance.onopen?.(new Event("open"));
    });

    const log = buildLog({
      from: "0x1111111111111111111111111111111111111111",
      amount,
      note: "gm",
      timestamp,
      blockNumber: 42n,
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      logIndex: 0n,
    });

    await act(async () => {
      emitWsMessage({
        jsonrpc: "2.0",
        method: "eth_subscription",
        params: { result: log },
      });
      await Promise.resolve();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.tips).toHaveLength(1);
    expect(result.current.tips[0]).toMatchObject({
      from: "0x1111111111111111111111111111111111111111",
      note: "gm",
      amountWei: amount,
      timestamp: Number(timestamp),
    });
  });

  it("falls back to polling when websocket errors", async () => {
    const amount = 5000n;
    const timestamp = 300n;
    const fallbackLog = buildLog({
      from: "0x9999999999999999999999999999999999999999",
      amount,
      note: "fallback",
      timestamp,
      blockNumber: 100n,
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      logIndex: 1n,
    });

    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      switch (body.method) {
        case "eth_blockNumber":
          return {
            json: async () => ({ result: "0x64" }),
          };
        case "eth_getLogsWithCursor":
          return {
            json: async () => ({ result: { logs: [fallbackLog], cursor: null } }),
          };
        default:
          throw new Error(`Unexpected RPC method ${body.method}`);
      }
    });
    globalThis.fetch = fetchMock;

    const { result } = renderHook(() =>
      useTipStream({ contractAddress, pollingIntervalMs: 1000, maxWebSocketRetries: 1 }),
    );

    const instance = MockWebSocket.instances[0];

    act(() => {
      instance.onerror?.(new Event("error"));
      instance.onclose?.({} as CloseEvent);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.status).toBe("polling");
    expect(result.current.tips).toHaveLength(1);
    expect(result.current.tips[0].note).toBe("fallback");
    expect(result.current.error).toBeNull();
  });

  it("skips websocket and throttles polling when throttled mode is active", async () => {
    process.env.NEXT_PUBLIC_TRANSPORT_SLIDER_MODE = "active-default";

    const fallbackLog = buildLog({
      from: "0x7777777777777777777777777777777777777777",
      amount: 1n,
      note: "throttled",
      timestamp: 400n,
      blockNumber: 150n,
      txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      logIndex: 2n,
    });

    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      switch (body.method) {
        case "eth_blockNumber":
          return {
            json: async () => ({ result: "0x96" }),
          };
        case "eth_getLogsWithCursor":
          return {
            json: async () => ({ result: { logs: [fallbackLog], cursor: null } }),
          };
        default:
          throw new Error(`Unexpected RPC method ${body.method}`);
      }
    });
    globalThis.fetch = fetchMock;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <TransportControlsProvider>{children}</TransportControlsProvider>
    );

    const { result } = renderHook(
      () =>
        useTipStream({
          contractAddress,
          pollingIntervalMs: 1000,
          maxWebSocketRetries: 2,
        }),
      { wrapper },
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(MockWebSocket.instances).toHaveLength(0);
    expect(result.current.status).toBe("polling");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example-rpc",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.current.tips[0]).toMatchObject({ note: "throttled" });
  });

  it("falls back to polling when subscription returns an error", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      switch (body.method) {
        case "eth_blockNumber":
          return {
            json: async () => ({ result: "0x64" }),
          };
        case "eth_getLogsWithCursor":
          return {
            json: async () => ({ result: { logs: [], cursor: null } }),
          };
        default:
          throw new Error(`Unexpected RPC method ${body.method}`);
      }
    });
    globalThis.fetch = fetchMock;

    const { result } = renderHook(() =>
      useTipStream({ contractAddress, pollingIntervalMs: 1000, maxWebSocketRetries: 1 }),
    );

    const instance = MockWebSocket.instances[0];

    act(() => {
      instance.onopen?.(new Event("open"));
    });

    const sentPayload = instance.sentMessages.at(-1);
    const subscriptionId = sentPayload ? JSON.parse(sentPayload).id : undefined;

    await act(async () => {
      emitWsMessage({
        jsonrpc: "2.0",
        id: subscriptionId,
        error: { code: -32601, message: "Method not found" },
      });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.status).toBe("polling");
    expect(result.current.error).toBeNull();
  });
});
