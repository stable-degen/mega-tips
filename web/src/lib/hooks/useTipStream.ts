"use client";

import {
  decodeEventLog,
  encodeEventTopics,
  formatEther,
  type Hex,
} from "viem";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tipJarAbi } from "@/lib/abis/TipJar";
import { useTransportControls } from "@/lib/transportControls";

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const CAUTIOUS_POLL_INTERVAL_MS = 20_000;
const MAX_TIP_HISTORY = 200;
const DEFAULT_MAX_WS_RETRIES = 1;
const MAX_BLOCK_WINDOW = BigInt(50_000);
const MAX_CURSOR_LOOPS = 3;
const MAX_POLL_FAILURES = 3;
const BLOCK_REFRESH_INTERVAL_MS = 60_000;

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
    pollingIntervalMs: basePollingIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxWebSocketRetries: baseMaxWebSocketRetries = DEFAULT_MAX_WS_RETRIES,
  } = options;

  const { mode } = useTransportControls();
  const isCautious = mode === "cautious";
  const effectivePollingIntervalMs = isCautious
    ? Math.max(basePollingIntervalMs, CAUTIOUS_POLL_INTERVAL_MS)
    : basePollingIntervalMs;
  const effectiveMaxWebSocketRetries = isCautious ? 0 : baseMaxWebSocketRetries;
  const effectiveMaxCursorLoops = isCautious ? 1 : MAX_CURSOR_LOOPS;

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
    null;

  const [tips, setTips] = useState<TipStreamEntry[]>([]);
  const [status, setStatus] = useState<TipStreamStatus>(
    contractAddress ? "connecting" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBlockRef = useRef<bigint>(BigInt(0));
  const seenIdsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | null>(null);
  const fromBlockRef = useRef<string | null>(null);
  const wsAttemptsRef = useRef(0);
  const connectRef = useRef<() => void>(() => undefined);
  const subscriptionRequestIdRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const pollFailuresRef = useRef(0);
  const isPollingRef = useRef(false);
  const nextAllowedPollRef = useRef(0);
  const lastBlockWindowRefreshRef = useRef(0);

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

  const callRpc = useCallback(
    async <T,>(method: string, params: unknown[]): Promise<T> => {
      if (!httpRpcUrl) {
        throw new Error("No HTTP RPC configured for polling fallback.");
      }

      const payload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      };

      const response = await fetch(httpRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (json?.error) {
        const message =
          typeof json.error?.message === "string"
            ? json.error.message
            : `RPC ${method} failed`;
        throw new Error(message);
      }

      return json.result as T;
    },
    [httpRpcUrl],
  );

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
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    isPollingRef.current = false;
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
    subscriptionRequestIdRef.current = null;
  }, []);

  const ensureFromBlock = useCallback(async (): Promise<string> => {
    if (fromBlockRef.current === "latest") {
      return fromBlockRef.current;
    }

    if (Date.now() < nextAllowedPollRef.current && fromBlockRef.current) {
      return fromBlockRef.current;
    }

    if (latestBlockRef.current > BigInt(0)) {
      const nextFrom = toHex(latestBlockRef.current + BigInt(1));
      fromBlockRef.current = nextFrom;
      return nextFrom;
    }

    try {
      const latestHex = await callRpc<string>("eth_blockNumber", []);
      const latest = latestHex ? BigInt(latestHex) : BigInt(0);
      const windowStart =
        latest > MAX_BLOCK_WINDOW ? latest - MAX_BLOCK_WINDOW + BigInt(1) : BigInt(0);
      const nextFrom = toHex(windowStart);
      fromBlockRef.current = nextFrom;
      return nextFrom;
    } catch (err) {
      console.warn("Failed to resolve latest block number", err);
      if (!fromBlockRef.current) {
        fromBlockRef.current = "latest";
      }
      return fromBlockRef.current;
    }
  }, [callRpc]);

  const fetchLogs = useCallback(async (): Promise<number> => {
    let nextDelay = effectivePollingIntervalMs;

    if (!contractAddress || !httpRpcUrl || cancelledRef.current) {
      return nextDelay;
    }

    if (isPollingRef.current) return nextDelay;
    isPollingRef.current = true;

    try {
      if (!fromBlockRef.current) {
        fromBlockRef.current = await ensureFromBlock();
      }

      let cursor = cursorRef.current;
      let iteration = 0;
      let receivedLogs = false;

      while (!cancelledRef.current) {
        const filter: Record<string, unknown> = {
          address: contractAddress,
          fromBlock: fromBlockRef.current,
          toBlock: "latest",
          topics: topics.length ? [topics[0]] : undefined,
        };

        if (cursor) {
          filter.cursor = cursor;
        }

        let result: unknown;

        try {
          result = await callRpc("eth_getLogsWithCursor", [filter]);
        } catch (err) {
          // Fall back to eth_getLogs if cursor method is unavailable.
          if (
            cursor === null &&
            err instanceof Error &&
            /method not found/i.test(err.message)
          ) {
            result = await callRpc("eth_getLogs", [filter]);
          } else {
            throw err;
          }
        }

        const payload =
          result && typeof result === "object" && !Array.isArray(result)
            ? (result as { logs?: TipLog[]; cursor?: string })
            : null;

        const logs = payload?.logs ?? (Array.isArray(result) ? (result as TipLog[]) : []);

        if (Array.isArray(logs) && logs.length) {
          receivedLogs = true;
          addTips(logs);
        }

        const nextCursor =
          typeof payload?.cursor === "string" && payload.cursor.length > 0
            ? payload.cursor
            : null;

        cursorRef.current = nextCursor;
        cursor = nextCursor;

        iteration += 1;

        if (!cursor || logs.length === 0 || iteration >= effectiveMaxCursorLoops) {
          break;
        }
      }

      // Refresh the window start so we don't exceed RPC block range limits.
      if (latestBlockRef.current > BigInt(0)) {
        fromBlockRef.current = toHex(latestBlockRef.current + BigInt(1));
      }
      const now = Date.now();
      if (
        now - lastBlockWindowRefreshRef.current > BLOCK_REFRESH_INTERVAL_MS ||
        !fromBlockRef.current ||
        fromBlockRef.current === "latest"
      ) {
        try {
          const latestHex = await callRpc<string>("eth_blockNumber", []);
          const latest = latestHex ? BigInt(latestHex) : BigInt(0);
          const windowStart =
            latest > MAX_BLOCK_WINDOW ? latest - MAX_BLOCK_WINDOW + BigInt(1) : BigInt(0);
          const nextFrom =
            latestBlockRef.current > BigInt(0)
              ? latestBlockRef.current + BigInt(1)
              : windowStart;
          fromBlockRef.current = toHex(nextFrom);
          lastBlockWindowRefreshRef.current = now;
        } catch (err) {
          console.warn("Failed to refresh polling block window", err);
          lastBlockWindowRefreshRef.current = now;
        }
      }

      pollFailuresRef.current = 0;
      setStatus((prev) => (prev === "error" || prev === "connecting" ? "polling" : prev));
      setError((prev) => (prev ? null : prev));

      if (!receivedLogs && cursorRef.current) {
        // If we have a cursor but received no logs, clear it to avoid stalling.
        cursorRef.current = null;
      }
    } catch (err) {
      if (!cancelledRef.current) {
        const message =
          err instanceof Error ? err.message : "Failed to poll tip events.";
        const retryMatch = /retry in\s+(\d+)\s*seconds?/i.exec(message ?? "");
        if (retryMatch) {
          const seconds = Number.parseInt(retryMatch[1] ?? "", 10);
          if (Number.isFinite(seconds) && seconds > 0) {
            nextDelay = Math.max(seconds * 1000, effectivePollingIntervalMs);
          }
          nextAllowedPollRef.current = Date.now() + nextDelay;
          pollFailuresRef.current = 0;
          setStatus((prev) => (prev === "error" ? "polling" : prev));
          setError((prev) => (prev ? null : prev));
          console.warn("Polling rate limited, backing off", { message, nextDelay });
        } else {
          pollFailuresRef.current += 1;
          console.warn("Polling error", err);
          if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
            setStatus("error");
            setError(message);
          }
        }
      }
    } finally {
      isPollingRef.current = false;
    }
    return nextDelay;
  }, [
    addTips,
    callRpc,
    contractAddress,
    effectiveMaxCursorLoops,
    effectivePollingIntervalMs,
    ensureFromBlock,
    httpRpcUrl,
    topics,
  ]);

  const startPolling = useCallback(() => {
    stopWebSocket();
    if (!httpRpcUrl) {
      setStatus("error");
      setError("No HTTP RPC configured for polling fallback.");
      return;
    }

    setStatus("polling");
    setError(null);
    pollFailuresRef.current = 0;
    cursorRef.current = null;
    fromBlockRef.current = null;
    nextAllowedPollRef.current = Date.now();
    lastBlockWindowRefreshRef.current = 0;

    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    const tick = async () => {
      const delay = await fetchLogs();
      if (cancelledRef.current) return;
      pollTimeoutRef.current = setTimeout(() => {
        void tick();
      }, delay);
    };

    void tick();
  }, [fetchLogs, httpRpcUrl, stopWebSocket]);

  useEffect(() => {
    if (!contractAddress) {
      setStatus("error");
      setError("MegaTip contract address is not configured.");
      return;
    }

    cancelledRef.current = false;
    wsAttemptsRef.current = 0;

    const handleFailure = (reason?: string) => {
      if (cancelledRef.current) return;

      if (reason) {
        console.warn("[MegaTip] realtime stream issue:", reason);
      }

      stopWebSocket();

      wsAttemptsRef.current += 1;

      if (!httpRpcUrl) {
        setStatus("error");
        setError(
          reason ??
            "Realtime connection unavailable and no HTTP RPC fallback is configured.",
        );
        return;
      }

      if (wsAttemptsRef.current >= effectiveMaxWebSocketRetries) {
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

      if (
        isCautious ||
        effectiveMaxWebSocketRetries <= 0 ||
        !realtimeWsUrl ||
        typeof WebSocket === "undefined"
      ) {
        startPolling();
        return;
      }

      setStatus("connecting");
      setError(null);
      subscriptionRequestIdRef.current = null;

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

        const requestId = Date.now();
        subscriptionRequestIdRef.current = requestId;

        const subscription = {
          id: requestId,
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

          if (payload?.id === subscriptionRequestIdRef.current && payload?.error) {
            const message =
              typeof payload.error?.message === "string"
                ? payload.error.message
            : "Realtime subscription error.";
            handleFailure(message);
            return;
          }

          if (payload?.method !== "eth_subscription") return;
          const result = payload?.params?.result;
          if (!result) return;

          addTips([result as TipLog]);
        } catch (err) {
          console.warn("Failed to parse websocket message", err);
        }
      };
    };

    connectRef.current = connect;

    connect();

    return () => {
      cancelledRef.current = true;
      connectRef.current = () => undefined;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      cursorRef.current = null;
      fromBlockRef.current = null;
      stopPolling();
      stopWebSocket();
    };
  }, [
    addTips,
    callRpc,
    contractAddress,
    effectiveMaxWebSocketRetries,
    httpRpcUrl,
    isCautious,
    realtimeWsUrl,
    startPolling,
    stopPolling,
    stopWebSocket,
    topics,
  ]);

  const reconnect = useCallback(() => {
    if (!contractAddress) return;
    wsAttemptsRef.current = 0;
    pollFailuresRef.current = 0;
    stopPolling();
    connectRef.current();
  }, [contractAddress, stopPolling]);

  return {
    tips,
    status,
    error,
    reconnect,
  };
}
