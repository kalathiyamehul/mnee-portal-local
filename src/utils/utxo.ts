import type { FundingUtxo } from "@/types/utxo";
import { MNEE_API } from "@/env";
import type { Utxo } from "js-1sat-ord";
import { Script, Utils } from "@bsv/sdk";

const { toBase64 } = Utils

export async function getFundingUtxos(fundingAddress: string): Promise<Utxo[]> {
  console.log('Fetching funding UTXOs for address:', fundingAddress);
  const utxosResponse = await fetch(`${MNEE_API}/v1/utxos/${fundingAddress}`);
  
  if (!utxosResponse.ok) {
    const errorText = await utxosResponse.text();
    console.error('Failed to fetch UTXOs:', {
      status: utxosResponse.status,
      error: errorText
    });
    throw new Error(`Failed to fetch UTXOs: ${errorText}`);
  }

  const utxos = await utxosResponse.json() as FundingUtxo[];
  console.log('Received UTXOs:', utxos);

  if (!Array.isArray(utxos)) {
    console.error('Invalid UTXOs response:', utxos);
    throw new Error('Invalid UTXOs response: expected array');
  }

  return utxos.map((utxo: FundingUtxo) => ({
    ...utxo,
    script: toBase64(Script.fromHex(utxo.locking_script).toBinary()),
  } as Utxo))
} 