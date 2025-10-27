"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { parseEther, type Hash } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { megaEthTestnet } from "@/lib/chains";
import { tipJarAbi } from "@/lib/abis/TipJar";

const MAX_NOTE_LENGTH = 140;

type StatusState = {
  type: "idle" | "submitting" | "confirming" | "success" | "error";
  message?: string;
};

const defaultStatus: StatusState = { type: "idle" };

type ErrorWithShortMessage = { shortMessage: string };
type ErrorWithMessage = { message: string };

function hasShortMessage(error: unknown): error is ErrorWithShortMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "shortMessage" in error &&
    typeof (error as Record<string, unknown>).shortMessage === "string"
  );
}

function hasErrorMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

function getReadableErrorMessage(error: unknown) {
  const fallback = "Transaction failed. Please try again.";

  if (!error) return fallback;
  let detail: string | null = null;

  if (hasShortMessage(error)) {
    detail = error.shortMessage;
  }
  if (!detail && hasErrorMessage(error)) {
    detail = error.message;
  }
  if (!detail && typeof error === "string") {
    detail = error;
  }

  if (!detail) return fallback;

  if (detail.toLowerCase().includes("transaction failed")) {
    return detail;
  }

  return `${fallback} (${detail})`;
}

export function TipForm() {
  const tipJarAddress = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_TIPJAR_ADDRESS ??
        process.env.PUBLIC_TIPJAR_ADDRESS) as `0x${string}` | undefined,
    [],
  );
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>(defaultStatus);
  const [txHash, setTxHash] = useState<Hash | undefined>();

  const sanitizedNote = useMemo(() => note.trim(), [note]);
  const noteLength = note.length;
  const charactersLeft = Math.max(0, MAX_NOTE_LENGTH - noteLength);

  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: megaEthTestnet.id,
    query: {
      enabled: Boolean(txHash),
      refetchOnWindowFocus: true,
    },
  });

  useEffect(() => {
    if (!txHash) return;

    if (isSuccess) {
      setStatus({ type: "success", message: "Tip confirmed! Thanks for supporting." });
      setAmount("");
      setNote("");
      setFormError(null);
      return;
    }

    if (isError) {
      setStatus({
        type: "error",
        message: getReadableErrorMessage(receiptError),
      });
      return;
    }

    if (isConfirming) {
      setStatus({
        type: "confirming",
        message: "Tip submitted. Awaiting confirmation...",
      });
    }
  }, [isConfirming, isError, isSuccess, receiptError, txHash]);

  const isSubmitDisabled =
    !isConnected || isPending || status.type === "submitting" || status.type === "confirming";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError(null);

    if (!isConnected) {
      setFormError("Connect your wallet to send a tip.");
      return;
    }

    if (!tipJarAddress) {
      setFormError("TipJar address is not configured.");
      return;
    }

    if (noteLength > MAX_NOTE_LENGTH) {
      setFormError("Note must be 140 characters or less.");
      return;
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = parseEther(amount.trim());
    } catch {
      setFormError("Enter a valid tip amount in ETH.");
      return;
    }

    if (parsedAmount <= BigInt(0)) {
      setFormError("Amount must be greater than 0.");
      return;
    }

    try {
      setStatus({ type: "submitting", message: "Sending tip..." });
      const hash = await writeContractAsync({
        address: tipJarAddress,
        abi: tipJarAbi,
        functionName: "tip",
        args: [sanitizedNote],
        value: parsedAmount,
        chainId: megaEthTestnet.id,
      });

      setTxHash(hash);
      setStatus({
        type: "confirming",
        message: "Tip submitted. Awaiting confirmation...",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: getReadableErrorMessage(error),
      });
      setTxHash(undefined);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-3xl border border-white/10 bg-black/40 p-6 text-sm text-slate-200 backdrop-blur"
      onSubmit={handleSubmit}
    >
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
          Send a tip
        </p>
        <h2 className="text-xl font-semibold text-slate-50">
          Fuel the creator with MegaETH
        </h2>
      </header>

      <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-emerald-200">
        Amount (ETH)
        <input
          aria-label="Amount"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/40"
          inputMode="decimal"
          name="amount"
          placeholder="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>

    <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-emerald-200">
        Note (optional)
        <textarea
          aria-label="Note"
          className="min-h-[96px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/40"
          name="note"
          placeholder="Drop a shoutout or message"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <span className="text-right text-[0.7rem] uppercase tracking-[0.25em] text-slate-500">
          {charactersLeft} left
        </span>
      </label>

      {(formError || status.message) && (
        <p
          role={status.type === "error" ? "alert" : undefined}
          className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
            status.type === "error" || formError
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : status.type === "success"
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/5 text-slate-200"
          }`}
        >
          {formError ?? status.message}
        </p>
      )}

      <button
        className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-emerald-500"
        disabled={isSubmitDisabled}
        type="submit"
      >
        {status.type === "submitting"
          ? "Sending..."
          : status.type === "confirming"
            ? "Pending"
            : status.type === "success"
              ? "Tipped"
              : "Send Tip"}
      </button>

      {!isConnected && (
        <p className="text-xs text-slate-400">
          Connect your wallet above to send a tip.
        </p>
      )}
    </form>
  );
}
