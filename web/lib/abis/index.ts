import type { Abi } from "viem";
import tipJarAbiJson from "./TipJar.json";

export const tipJarAbi = tipJarAbiJson as Abi;

export type TipJarAbi = typeof tipJarAbi;

export const createTipJarConfig = (address: `0x${string}`) => ({
  address,
  abi: tipJarAbi,
}) as const;
