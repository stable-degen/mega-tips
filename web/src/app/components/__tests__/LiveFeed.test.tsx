import { fireEvent, render, screen } from "@testing-library/react";
import { Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTipStream } from "@/lib/hooks";
import { LiveFeed } from "../LiveFeed";

vi.mock("@/lib/hooks", () => ({
  useTipStream: vi.fn(),
}));

const mockedUseTipStream = vi.mocked(useTipStream);

describe("LiveFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:05:00.000Z"));
    mockedUseTipStream.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an empty state when no tips are available", () => {
    mockedUseTipStream.mockReturnValue({
      tips: [],
      status: "connecting",
      error: null,
      reconnect: vi.fn(),
    });

    render(<LiveFeed />);

    expect(
      screen.getByText(/tips will appear the moment someone contributes/i),
    ).toBeInTheDocument();
  });

  it("displays streamed tips with truncated addresses and notes", () => {
    const tips = [
      {
        id: "tx-1:0",
        txHash: "0xabc" as Hex,
        blockNumber: BigInt(1),
        logIndex: 0,
        from: "0x1234567890abcdef1234567890abcdef12345678" as Hex,
        amountWei: BigInt(1),
        amountEth: "0.001",
        note: "Thanks for the alpha!",
        timestamp: Math.floor(
          new Date("2025-01-01T00:04:00.000Z").getTime() / 1000,
        ),
      },
    ];

    mockedUseTipStream.mockReturnValue({
      tips,
      status: "connected",
      error: null,
      reconnect: vi.fn(),
    });

    render(<LiveFeed maxItems={5} />);

    expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
    expect(screen.getByText("Thanks for the alpha!")).toBeInTheDocument();
    expect(screen.getByText("1m ago")).toBeInTheDocument();
    expect(screen.getByText(/0\.001\s+ETH/i)).toBeInTheDocument();
  });

  it("surfaces errors with a retry affordance", () => {
    const reconnect = vi.fn();
    mockedUseTipStream.mockReturnValue({
      tips: [],
      status: "error",
      error: "Realtime connection failed",
      reconnect,
    });

    render(<LiveFeed />);

    fireEvent.click(screen.getByRole("button", { name: /retry connection/i }));
    expect(reconnect).toHaveBeenCalledTimes(1);
  });
});
