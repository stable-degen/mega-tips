import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TipForm } from "../TipForm";

const contractAddress = "0x1111111111111111111111111111111111111111";
const walletAddress = "0x7d0975a570aFfFcC28346c26E9fA13C3Ca4F3ED9";

type WaitState = { mode: "idle" | "loading" | "success" | "error" };

const mockUseAccount = vi.fn();
const mockUseWriteContract = vi.fn();
const mockUseWaitForTransactionReceipt = vi.fn();

let writeContractAsyncMock: ReturnType<typeof vi.fn>;
let waitState: WaitState;
type WaitMock = typeof mockUseWaitForTransactionReceipt & { waitState?: WaitState };

vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");

  return {
    ...actual,
    useAccount: () => mockUseAccount(),
    useWriteContract: () => mockUseWriteContract(),
    useWaitForTransactionReceipt: (args?: { hash?: string }) =>
      mockUseWaitForTransactionReceipt(args),
  };
});

describe("TipForm", () => {
  beforeEach(() => {
    mockUseAccount.mockReset();
    mockUseWriteContract.mockReset();
    mockUseWaitForTransactionReceipt.mockReset();

    process.env.NEXT_PUBLIC_TIPJAR_ADDRESS = contractAddress;

    mockUseAccount.mockReturnValue({
      address: walletAddress,
      isConnected: true,
    });

    writeContractAsyncMock = vi.fn().mockResolvedValue("0xtxhash" as const);

    mockUseWriteContract.mockReturnValue({
      writeContractAsync: writeContractAsyncMock,
      isPending: false,
      data: undefined,
    });

    waitState = { mode: "idle" };

    mockUseWaitForTransactionReceipt.mockImplementation(
      (args: { hash?: string } = {}) => {
        const { hash } = args;
        if (!hash) {
          return { isLoading: false, isSuccess: false, isError: false };
        }

        if (waitState.mode === "success") {
          return { isLoading: false, isSuccess: true, isError: false };
        }

        if (waitState.mode === "error") {
          return {
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: new Error("boom"),
          };
        }

        return { isLoading: true, isSuccess: false, isError: false };
      },
    );

    (mockUseWaitForTransactionReceipt as WaitMock).waitState = waitState;
  });

  it("blocks submission when the note is too long", async () => {
    const user = userEvent.setup();

    render(<TipForm />);

    await user.type(screen.getByLabelText(/amount/i), "0.01");
    await user.type(screen.getByLabelText(/note/i), "a".repeat(150));
    await user.click(screen.getByRole("button", { name: /send tip/i }));

    expect(
      screen.getByText(/note must be 140 characters or less/i),
    ).toBeInTheDocument();
    expect(writeContractAsyncMock).not.toHaveBeenCalled();
  });

  it("submits a tip and shows confirmation flow", async () => {
    const user = userEvent.setup();
    const waitMock = mockUseWaitForTransactionReceipt as WaitMock;
    const waitStateRef = waitMock.waitState;
    if (!waitStateRef) {
      throw new Error("waitState not initialised");
    }
    waitStateRef.mode = "loading";

    const { rerender } = render(<TipForm />);

    await user.type(screen.getByLabelText(/amount/i), "0.01");
    await user.type(screen.getByLabelText(/note/i), "Great job!");
    await user.click(screen.getByRole("button", { name: /send tip/i }));

    await waitFor(() => expect(writeContractAsyncMock).toHaveBeenCalledTimes(1));

    expect(writeContractAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "tip",
        args: ["Great job!"],
        value: expect.any(BigInt),
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/tip submitted\. awaiting confirmation/i),
      ).toBeInTheDocument(),
    );

    waitStateRef.mode = "success";
    rerender(<TipForm />);

    await waitFor(() =>
      expect(screen.getByText(/tip confirmed/i)).toBeInTheDocument(),
    );

    expect(screen.getByLabelText(/amount/i)).toHaveValue("");
    expect(screen.getByLabelText(/note/i)).toHaveValue("");
  });

  it("surfaces contract errors when submission fails", async () => {
    const user = userEvent.setup();
    writeContractAsyncMock.mockRejectedValueOnce(new Error("rejected"));

    render(<TipForm />);

    await user.type(screen.getByLabelText(/amount/i), "0.02");
    await user.type(screen.getByLabelText(/note/i), "hello");
    await user.click(screen.getByRole("button", { name: /send tip/i }));

    await waitFor(() =>
      expect(screen.getByText(/transaction failed/i)).toBeInTheDocument(),
    );
  });
});
