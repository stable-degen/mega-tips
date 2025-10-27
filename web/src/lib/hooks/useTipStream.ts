"use client";

import {
  decodeEventLog,
  encodeEventTopics,
  formatEther,
  type Hex,
} from "viem";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tipJarAbi } from "@/lib/abis/TipJar";

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const MAX_TIP_HISTORY = 200;
const DEFAULT_MAX_WS_RETRIES = 3;

type TipLog = {
  address?: string;
  data: Hex;
  topics: Hex[];
  transactionHash?: Hex;
  logIndex?: Hex;
  blockNumber?: Hex;
};

type TipStreamStatus = "idle" | "connecting" | "connected" | "polling" | "error";

export type TipStreamEntry = {
  id: string;
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  from: Hex;
  amountWei: bigint;
  amountEth: string;
  note: string;
  timestamp: number;
};

export type UseTipStreamOptions = {
  contractAddress?: Hex;
  pollingIntervalMs?: number;
  maxWebSocketRetries?: number;
};

export type UseTipStreamState = {
  tips: TipStreamEntry[];
  status: TipStreamStatus;
  error: string | null;
  reconnect: () => void;
};

function toHex(block: bigint) {
  return `0x${block.toString(16)}` as Hex;
}

function parseLog(log: TipLog) {
  if (!log.topics || log.topics.length === 0) return null;

  const decoded = decodeEventLog({
    abi: tipJarAbi,
    data: log.data,
    topics: log.topics as [Hex, ...Hex[]],
  });

  if (decoded.eventName !== "Tipped") return null;

  const args = decoded.args as {
    from: Hex;
    amount: bigint;
    note: string;
    timestamp: bigint;
  };

  const blockNumber = log.blockNumber ? BigInt(log.blockNumber) : BigInt(0);
  const logIndex = log.logIndex ? Number(BigInt(log.logIndex)) : 0;
  const txHash = (log.transactionHash ?? "0x") as Hex;
  const id = `${txHash}:${logIndex}`;

  return {
    id,
    txHash,
    blockNumber,
    logIndex,
    from: args.from,
    amountWei: args.amount,
    amountEth: formatEther(args.amount),
    note: args.note,
    timestamp: Number(args.timestamp),
  } satisfies TipStreamEntry;
}

export function useTipStream(options: UseTipStreamOptions = {}): UseTipStreamState {
  const {
    contractAddress: providedAddress,
    pollingIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxWebSocketRetries = DEFAULT_MAX_WS_RETRIES,
  } = options;

  const envAddress =
    (process.env.NEXT_PUBLIC_TIPJAR_ADDRESS ??
      process.env.PUBLIC_TIPJAR_ADDRESS) as Hex | undefined;
  const contractAddress = providedAddress ?? envAddress;

  const realtimeWsUrl =
    process.env.NEXT_PUBLIC_REALTIME_WS ??
    process.env.PUBLIC_REALTIME_WS ??
    process.env.NEXT_PUBLIC_RPC_WS ??
    process.env.PUBLIC_RPC_WS ??
    null;

  const httpRpcUrl =
    process.env.NEXT_PUBLIC_RPC_HTTP ??
    process.env.PUBLIC_RPC_HTTP ??
    "";

  const [tips, setTips] = useState<TipStreamEntry[]>([]);
  const [status, setStatus] = useState<TipStreamStatus>(
    contractAddress ? "connecting" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestBlockRef = useRef<bigint>(BigInt(0));
  const seenIdsRef = useRef<Set<string>>(new Set());
  const wsAttemptsRef = useRef(0);
  const connectRef = useRef<() => void>(() => undefined);
  const cancelledRef = useRef(false);

  const topics = useMemo(() => {
    try {
      const encoded = encodeEventTopics({
        abi: tipJarAbi,
        eventName: "Tipped",
      });
      return encoded ?? [];
    } catch (err) {
      console.error("Failed to encode Tipped event topics", err);
      return [] as Hex[];
    }
  }, []);

  const addTips = useCallback((nextLogs: TipLog[]) => {
    if (!nextLogs.length) return;

    setTips((prev) => {
      let updated = prev;

      for (const log of nextLogs) {
        const entry = parseLog(log);
        if (!entry) continue;
        if (seenIdsRef.current.has(entry.id)) continue;

        seenIdsRef.current.add(entry.id);
        if (entry.blockNumber > latestBlockRef.current) {
          latestBlockRef.current = entry.blockNumber;
        }

        if (updated === prev) {
          updated = [...prev];
        }
        updated = [entry, ...updated];
      }

      if (updated.length > MAX_TIP_HISTORY) {
        updated = updated.slice(0, MAX_TIP_HISTORY);
      }

      return updated;
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const stopWebSocket = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.onopen = null;
      websocketRef.current.onerror = null;
      websocketRef.current.onclose = null;
      websocketRef.current.onmessage = null;
      try {
        websocketRef.current.close();
      } catch (err) {
        console.warn("Failed to close websocket", err);
      }
      websocketRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopWebSocket();
    if (!httpRpcUrl) {
      setStatus("error");
      setError("No HTTP RPC configured for polling fallback.");
      return;
    }

    setStatus("polling");
    setError(null);

    const fetchLogs = async () => {
      try {
        const fromBlock =
          latestBlockRef.current > BigInt(0)
            ? latestBlockRef.current + BigInt(1)
            : BigInt(0);

        const payload = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_getLogs",
          params: [
            {
              address: contractAddress,
              fromBlock: toHex(fromBlock),
              toBlock: "latest",
              topics: topics.length ? [topics[0]] : undefined,
            },
          ],
        };

        const response = await fetch(httpRpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await response.json();
        if (json.error) {
          throw new Error(json.error.message ?? "RPC error");
        }

        if (Array.isArray(json.result)) {
          addTips(json.result as TipLog[]);
        }
      } catch (err) {
        if (cancelledRef.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to poll tip events.";
        setError(message);
      }
    };

    void fetchLogs();
    pollIntervalRef.current = setInterval(fetchLogs, pollingIntervalMs);
  }, [addTips, contractAddress, httpRpcUrl, pollingIntervalMs, stopWebSocket, topics]);

  useEffect(() => {
    if (!contractAddress) {
      setStatus("error");
      setError("TipJar contract address is not configured.");
      return;
    }

    cancelledRef.current = false;
    wsAttemptsRef.current = 0;

    const handleFailure = (reason?: string) => {
      if (cancelledRef.current) return;

      if (reason) {
        setError(reason);
      }

      stopWebSocket();

      wsAttemptsRef.current += 1;
      if (wsAttemptsRef.current >= maxWebSocketRetries) {
        startPolling();
        return;
      }

      const delay = Math.min(30_000, 1000 * 2 ** (wsAttemptsRef.current - 1));
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!cancelledRef.current) {
          connectRef.current();
        }
      }, delay);
    };

    const connect = () => {
      if (cancelledRef.current) return;

      stopPolling();
      stopWebSocket();

      if (!realtimeWsUrl || typeof WebSocket === "undefined") {
        startPolling();
        return;
      }

      setStatus("connecting");
      setError(null);

      let opened = false;

      try {
        websocketRef.current = new WebSocket(realtimeWsUrl);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create websocket.";
        handleFailure(message);
        return;
      }

      const ws = websocketRef.current;
      if (!ws) return;

      ws.onopen = () => {
        if (cancelledRef.current) return;
        opened = true;
        wsAttemptsRef.current = 0;
        setStatus("connected");
        setError(null);

        const subscription = {
          id: Date.now(),
          jsonrpc: "2.0",
          method: "eth_subscribe",
          params: [
            "logs",
            {
              address: contractAddress,
              topics: topics.length ? [topics[0]] : undefined,
            },
          ],
        };

        try {
          ws.send(JSON.stringify(subscription));
        } catch (sendError) {
          const message =
            sendError instanceof Error
              ? sendError.message
              : "Failed to subscribe to events.";
          handleFailure(message);
        }
      };

      ws.onerror = () => {
        if (cancelledRef.current) return;
        handleFailure("Realtime connection error.");
      };

      ws.onclose = () => {
        if (cancelledRef.current) return;
        if (!opened) {
          handleFailure("Realtime connection closed before handshake.");
        } else {
          handleFailure("Realtime connection closed.");
        }
      };

      ws.onmessage = (event) => {
        if (cancelledRef.current) return;

        try {
          const payload = JSON.parse(String(event.data));
          if (payload?.method !== "eth_subscription") return;
          const result = payload?.params?.result;
          if (!result) return;

          addTips([result as TipLog]);
        } catch (err) {
          console.warn("Failed to parse websocket message", err);
        }
      };
    };

    connectRef.current = () => {
      wsAttemptsRef.current = 0;
      connect();
    };

    connect();

    return () => {
      cancelledRef.current = true;
      connectRef.current = () => undefined;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      stopPolling();
      stopWebSocket();
    };
  }, [
    addTips,
    contractAddress,
    maxWebSocketRetries,
    realtimeWsUrl,
    startPolling,
    stopPolling,
    stopWebSocket,
    topics,
  ]);

  const reconnect = useCallback(() => {
    if (!contractAddress) return;
    wsAttemptsRef.current = 0;
    if (pollIntervalRef.current) {
      stopPolling();
    }
    connectRef.current();
  }, [contractAddress, stopPolling]);

  return {
    tips,
    status,
    error,
    reconnect,
  };
}
