import { MNEE_API } from "@/env";
import type { Config, MNEEUtxo } from "@/types";
import type { IndexContext } from "@/types/indexContext";
import { Transaction, Utils } from "@bsv/sdk";
const { toArray } = Utils;

export const fetchConfig = async () => {
    const response = await fetch(`${MNEE_API}/v1/config`);
    if (!response.ok) {
        throw new Error("Failed to fetch config");
    }
    return await response.json() as Config;
}

export const fetchTransaction = async (txid: string) => {
    const response = await fetch(`${MNEE_API}/v1/tx/${txid}`);
    if (!response.ok) {
        throw new Error("Failed to fetch transaction");
    }

    const { rawtx } = await response.json() as { rawtx: string };
    if (!rawtx) {
        throw new Error("Failed to fetch transaction");
    }

    return Transaction.fromBinary(toArray(rawtx, 'base64'));
}

export const fetchMneeUtxos = async (addresses: string[], op: 'transfer' | 'burn' = 'transfer') => {
    if (!MNEE_API) {
        throw new Error("MNEE_API not defined");
    }

    const response = await fetch(`${MNEE_API}/v1/utxos/`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addresses),
    });
    if (!response.ok) {
        throw new Error("Failed to fetch UTXOs");
    }
    const json = await response.json() as MNEEUtxo[];
    if (op) {
        return json.filter((utxo) => utxo.data.bsv21.op.toLowerCase() === op);
    }
    return json;
};

export const ingestTxid = async (txid: string) => {
  const response = await fetch(`${MNEE_API}/v1/ingest/${txid}`, {
    method: 'POST',
  });
  return await response.json() as IndexContext;
}