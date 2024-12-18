import type { FundingUtxo } from "@/types/utxo";
import { MNEE_API } from "@/env";

export async function getFundingUtxos(fundingAddress: string) {
  const utxosResponse = await fetch(`${MNEE_API}/v1/utxos/${fundingAddress}`);
  return (await utxosResponse.json()) as FundingUtxo[];
} 