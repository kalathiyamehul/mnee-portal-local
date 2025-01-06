import type { FundingUtxo } from "@/types/utxo";
import { MNEE_API } from "@/env";

export async function getFundingUtxos(fundingAddress: string): Promise<FundingUtxo[]> {
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

  const utxos = await utxosResponse.json();
  console.log('Received UTXOs:', utxos);

  if (!Array.isArray(utxos)) {
    console.error('Invalid UTXOs response:', utxos);
    throw new Error('Invalid UTXOs response: expected array');
  }

  return utxos;
} 