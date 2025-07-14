import { MNEE_API } from "@/env";
import type { Config, MNEEUtxo } from "@/types";
import type { IndexContext } from "@/types/indexContext";
import { sanitizeHttpError } from "@/utils/errorHandler";
import { Transaction, Utils } from "@bsv/sdk";
const { toArray } = Utils;

let csrfToken: string | null = null;

async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const res = await apiFetch('/api/csrf');
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

    const response = await fetch(url, { ...options, headers });

    // Handle rate limiting responses
    if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        const retryAfter = response.headers.get('Retry-After');

        throw new Error(
            errorData.message ||
            `Rate limit exceeded. ${retryAfter ? `Try again in ${retryAfter} seconds.` : 'Please try again later.'}`
        );
    }

    return response;
}

export function resetCsrfToken() {
    csrfToken = null;
}

export const fetchConfig = async () => {
    const response = await fetch(`${MNEE_API}/v1/config`);
    if (!response.ok) {
        const sanitizedError = await sanitizeHttpError(response, "Failed to fetch config");
        throw new Error(sanitizedError.message);
    }
    return await response.json() as Config;
}

export const fetchTxo = async (outpoint: string) => {
  const response = await fetch(`${MNEE_API}/v1/txos/${outpoint}?tags=*&txo=true`);
  if (!response.ok) {
      const sanitizedError = await sanitizeHttpError(response, "Failed to fetch txo");
      throw new Error(sanitizedError.message);
  }
  return await response.json() as MNEEUtxo;
}

export const fetchTransaction = async (txid: string) => {
    const response = await fetch(`${MNEE_API}/v1/tx/${txid}`);
    if (!response.ok) {
        const sanitizedError = await sanitizeHttpError(response, "Failed to fetch transaction");
        throw new Error(sanitizedError.message);
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

    const response = await fetch(`${MNEE_API}/v1/utxos`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addresses),
    });
    if (!response.ok) {
        const sanitizedError = await sanitizeHttpError(response, "Failed to fetch UTXOs");
        throw new Error(sanitizedError.message);
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
        const sanitizedError = await sanitizeHttpError(response, "Failed to fetch UTXOs");
        throw new Error(sanitizedError.message);
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