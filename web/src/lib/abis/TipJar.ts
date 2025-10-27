import type { Abi } from "viem";

export const tipJarAbi = [
  {
    type: "constructor",
    inputs: [{ name: "_owner", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Tipped",
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "from",
        type: "address",
        internalType: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        indexed: false,
        name: "note",
        type: "string",
        internalType: "string",
      },
      {
        indexed: false,
        name: "timestamp",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "event",
    name: "Withdraw",
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "MAX_NOTE_LENGTH",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
  },
  {
    type: "function",
    stateMutability: "payable",
    name: "tip",
    inputs: [{ name: "note", type: "string", internalType: "string" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "tipsByUser",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "totalTips",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "withdraw",
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address payable",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
  },
] as const satisfies Abi;

