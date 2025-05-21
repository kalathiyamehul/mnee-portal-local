import { MNEE_API } from "@/env";
import type { Config, MNEEUtxo } from "@/types";
import type { IndexContext } from "@/types/indexContext";
import { Transaction, Utils } from "@bsv/sdk";
const { toArray } = Utils;

let csrfToken: string | null = null;

async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const res = await fetch('/api/csrf');
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
}

export async function apiFetch(
    url: string,
    options: RequestInit = {},
    { requireCsrf = false }: { requireCsrf?: boolean } = {}
) {
    const headers = new Headers(options.headers || {});

    // Add CSRF token for mutating requests
    if (requireCsrf || ['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
        const token = await getCsrfToken();
        headers.set('x-csrf-token', token || '');
    }

    // Always set content-type for JSON if body is present and not already set
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, { ...options, headers });
}

export function resetCsrfToken() {
    csrfToken = null;
}

export const fetchConfig = async () => {
    const response = await fetch(`${MNEE_API}/v1/config`);
    if (!response.ok) {
        throw new Error("Failed to fetch config");
    }
    return await response.json() as Config;
}

export const fetchTxo = async (outpoint: string) => {
  const response = await fetch(`${MNEE_API}/v1/txos/${outpoint}?tags=*&txo=true`);
  if (!response.ok) {
    throw new Error("Failed to fetch txo");
  }
  return await response.json() as MNEEUtxo;
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

export const fetchMneeUtxos = async (addresses: string[], ops: ('transfer' | 'burn' | 'deploy+mint')[] = ['transfer', 'deploy+mint']) => {
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
    // console.log('Fetched UTXOs:', json);
    if (ops.length) {
        return json.filter((utxo) => ops.includes(utxo.data.bsv21.op.toLowerCase() as 'transfer' | 'burn' | 'deploy+mint'));
    }
    return json;
};


export const fetchVaultedMneeUtxos = async (ops: ('transfer' | 'burn' | 'deploy+mint')[] = ['transfer', 'deploy+mint']) => {
    if (!MNEE_API) {
        throw new Error("MNEE_API not defined");
    }

    const response = await fetch(`${MNEE_API}/v1/utxos/vault`);
    if (!response.ok) {
        throw new Error("Failed to fetch UTXOs");
    }
    const json = await response.json() as MNEEUtxo[];
    // console.log('Fetched UTXOs:', json);
    if (ops.length) {
        return json.filter((utxo) => ops.includes(utxo.data.bsv21.op.toLowerCase() as 'transfer' | 'burn' | 'deploy+mint'));
    }
    return json;
};

export const ingestTxid = async (txid: string) => {
  const response = await fetch(`${MNEE_API}/v1/ingest/${txid}`, {
    method: 'POST',
  });
  return await response.json() as IndexContext;
}