// src/services/sui.ts
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { MIST_PER_SUI } from "@mysten/sui/utils";
import { getZkLoginSignature, genAddressSeed } from "@mysten/sui/zklogin";
import type { PartialZkLoginSignature } from "../types/zk";



export const suiClient = (url: string) => new SuiClient({ url });

export function toMist(amount: string): bigint {
  const [intPart, fracPart = ""] = amount.split(".");
  const frac9 = (fracPart + "000000000").slice(0, 9);
  return BigInt(intPart || "0") * MIST_PER_SUI + BigInt(frac9);
}

export async function executeZkTransfer(params: {
  client: SuiClient;
  sender: string;
  recipient: string;
  amountSui: string;
  ephemeralSigner: Parameters<Transaction["sign"]>[0]["signer"];
  jwtSub: string;
  jwtAud: string;
  userSalt: string; // decimal string
  zkProof: PartialZkLoginSignature;
  maxEpoch: number;
}) {
  const { client, sender, recipient, amountSui, ephemeralSigner, jwtSub, jwtAud, userSalt, zkProof, maxEpoch } = params;

  const txb = new Transaction();
  const [coin] = txb.splitCoins(txb.gas, [toMist(amountSui)]);
  txb.transferObjects([coin], recipient);
  txb.setSender(sender);

  const { bytes, signature: userSignature } = await txb.sign({ client, signer: ephemeralSigner });

  const addressSeed = genAddressSeed(BigInt(userSalt), "sub", jwtSub, jwtAud).toString();

  const zkLoginSignature = getZkLoginSignature({
    inputs: { ...zkProof, addressSeed },
    maxEpoch,
    userSignature,
  });

  return client.executeTransactionBlock({
    transactionBlock: bytes,
    signature: zkLoginSignature,
  });
}
