import { decryptKmsValue } from './lib/kms';

// Utility function to get decrypted env var
async function getDecryptedEnvVar(name: string, encrypted = true): Promise<string> {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  if (!encrypted) {
    return value;
  }
  return decryptKmsValue(value);
}

// server side
let MINT_WIF: string | undefined;
let BURN_WIF: string | undefined;

// Initialize encrypted variables
export async function initializeEnv() {
  try {
    MINT_WIF = await getDecryptedEnvVar('MINT_WIF');
    BURN_WIF = await getDecryptedEnvVar('BURN_WIF');
  } catch (error) {
    console.error('Error initializing encrypted environment variables:', error);
    throw error;
  }
}

// Getter functions for encrypted values
export function getMintWif(): string {
  if (!MINT_WIF) {
    throw new Error('MINT_WIF not initialized');
  }
  return MINT_WIF;
}

export function getBurnWif(): string {
  if (!BURN_WIF) {
    throw new Error('BURN_WIF not initialized');
  }
  return BURN_WIF;
}

// frontend (not encrypted)
export const MNEE_API = process.env.NEXT_PUBLIC_MNEE_API as string;
