import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WalletPanel } from "../WalletPanel";

vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Connect"}</button>
  ),
}));

const mockUseAccount = vi.fn();
const mockUseBalance = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");

  return {
    ...actual,
    useAccount: () => mockUseAccount(),
    useBalance: (args: unknown) => mockUseBalance(args),
    useDisconnect: () => ({
      disconnect: mockDisconnect,
      isPending: false,
    }),
  };
});

describe("WalletPanel", () => {
  beforeEach(() => {
    mockUseAccount.mockReset();
    mockUseBalance.mockReset();
    mockDisconnect.mockReset();
    window.localStorage.clear();
  });

  it("renders placeholder state when wallet is disconnected", () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    });

    render(<WalletPanel />);

    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    expect(screen.queryByText(/Balance/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view on explorer/i })).not.toBeInTheDocument();
  });

  it("shows address, balance, and explorer link when connected", async () => {
    const address = "0x7d0975a570aFfFcC28346c26E9fA13C3Ca4F3ED9";
    mockUseAccount.mockReturnValue({ address, isConnected: true });
    mockUseBalance.mockReturnValue({
      data: {
        formatted: "1.2345",
        symbol: "ETH",
      },
      isFetched: true,
      refetch: vi.fn(),
      isFetching: false,
      error: null,
    });

    render(<WalletPanel />);

    expect(await screen.findByText("0x7d09...3ED9")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-balance-value")).toHaveTextContent("1.2345 ETH");
    const explorerLink = screen.getByRole("link", { name: /view on explorer/i });
    expect(explorerLink).toHaveAttribute(
      "href",
      `https://www.okx.com/web3/explorer/megaeth-testnet/address/${address}`,
    );

    const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
    await userEvent.click(disconnectButton);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
