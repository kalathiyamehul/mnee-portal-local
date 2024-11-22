import { Config, MNEEUtxo } from "@/types";
import { Transaction } from "@bsv/sdk";

const MNEE_API = process.env.NEXT_PUBLIC_MNEE_API;

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

    return Transaction.fromHex(rawtx);
}

export const fetchMneeUtxos = async (addresses: string[]) => {
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
    return await response.json() as MNEEUtxo[];
};