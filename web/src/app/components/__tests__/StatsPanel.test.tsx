import { render, screen } from "@testing-library/react";
import { parseEther, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTipStream } from "@/lib/hooks";
import { StatsPanel } from "../StatsPanel";

vi.mock("@/lib/hooks", () => ({
  useTipStream: vi.fn(),
}));

const mockedUseTipStream = vi.mocked(useTipStream);

describe("StatsPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:20:00.000Z"));
    mockedUseTipStream.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders zeroed metrics when no tips have been streamed", () => {
    mockedUseTipStream.mockReturnValue({
      tips: [],
      status: "idle",
      error: null,
      reconnect: vi.fn(),
    });

    render(<StatsPanel />);

    expect(
      screen.getByText(/total volume/i).closest("div")?.textContent,
    ).toMatch(/0\.000\s*ETH/);
    expect(
      screen.getByText(/unique tippers/i).closest("div")?.textContent,
    ).toMatch(/0(?!\.)/);
    expect(
      screen.getByText(/largest tip/i).closest("div")?.textContent,
    ).toMatch(/0\.000\s*ETH/);
    expect(
      screen.getByText(/tips \/ min/i).closest("div")?.textContent,
    ).toMatch(/0\.00/);
  });

  it("calculates aggregate metrics from streamed tips", () => {
    const tips = [
      {
        id: "tx-1:0",
        txHash: "0xabc" as Hex,
        blockNumber: BigInt(10),
        logIndex: 0,
        from: "0xaaaa000000000000000000000000000000000001" as Hex,
        amountWei: parseEther("0.5"),
        amountEth: "0.5",
        note: "Great stream!",
        timestamp: Math.floor(new Date("2025-01-01T00:19:00.000Z").getTime() / 1000),
      },
      {
        id: "tx-2:0",
        txHash: "0xdef" as Hex,
        blockNumber: BigInt(12),
        logIndex: 0,
        from: "0xbbbb000000000000000000000000000000000002" as Hex,
        amountWei: parseEther("1"),
        amountEth: "1",
        note: "WAGMI",
        timestamp: Math.floor(new Date("2025-01-01T00:10:00.000Z").getTime() / 1000),
      },
      {
        id: "tx-3:0",
        txHash: "0xghi" as Hex,
        blockNumber: BigInt(8),
        logIndex: 0,
        from: "0xaaaa000000000000000000000000000000000001" as Hex,
        amountWei: parseEther("0.2"),
        amountEth: "0.2",
        note: "Old tip",
        timestamp: Math.floor(new Date("2024-12-31T23:59:00.000Z").getTime() / 1000),
      },
    ];

    mockedUseTipStream.mockReturnValue({
      tips,
      status: "connected",
      error: null,
      reconnect: vi.fn(),
    });

    render(<StatsPanel />);

    expect(
      screen.getByText(/total volume/i).closest("div")?.textContent,
    ).toMatch(/1\.700\s*ETH/);
    expect(
      screen.getByText(/unique tippers/i).closest("div")?.textContent,
    ).toMatch(/2(?!\.)/);
    expect(
      screen.getByText(/largest tip/i).closest("div")?.textContent,
    ).toMatch(/1\.000\s*ETH/);
    expect(
      screen.getByText(/tips \/ min/i).closest("div")?.textContent,
    ).toMatch(/0\.20/);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
