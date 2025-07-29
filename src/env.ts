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
    // Try unencrypted values first
    MINT_WIF = process.env.MINT_WIF;
    BURN_WIF = process.env.BURN_WIF;

    // If unencrypted values not found, try encrypted values
    if (!MINT_WIF) {
      const encryptedMintWif = process.env.ENCRYPTED_MINT_WIF;
      if (!encryptedMintWif) {
        throw new Error('Missing environment variable: MINT_WIF or ENCRYPTED_MINT_WIF');
      }
      MINT_WIF = await decryptKmsValue(encryptedMintWif);
    }

    if (!BURN_WIF) {
      const encryptedBurnWif = process.env.ENCRYPTED_BURN_WIF;
      if (!encryptedBurnWif) {
        throw new Error('Missing environment variable: BURN_WIF or ENCRYPTED_BURN_WIF');
      }
      BURN_WIF = await decryptKmsValue(encryptedBurnWif);
    }
  } catch (error) {
    console.error('Error initializing environment variables:', error);
    throw error;
  }
}

// Getter functions for values
export async function getMintWif(): Promise<string> {
  if (!MINT_WIF) {
    await initializeEnv();
    if (!MINT_WIF) {
      throw new Error('MINT_WIF not initialized');
    }
  }
  return MINT_WIF;
}

export async function getBurnWif(): Promise<string> {
  if (!BURN_WIF) {
    await initializeEnv();
    if (!BURN_WIF) {
      throw new Error('BURN_WIF not initialized');
    }
  }
  return BURN_WIF;
}

// frontend (not encrypted)
export const MNEE_API = process.env.NEXT_PUBLIC_MNEE_API as string;
export const MNEE_WEBHOOK_API = process.env.NEXT_PUBLIC_MNEE_WEBHOOK_API as string;
export const APPROVER_PUBKEY = process.env.APPROVER_PUBKEY as string;
export const MINT_ADDRESS = process.env.MINT_ADDRESS as string;

