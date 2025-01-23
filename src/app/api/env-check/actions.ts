'use server'

import { MINT_WIF, BURN_WIF } from '@/env'

export async function checkServerEnvVars() {
  return {
    hasMintWif: !!MINT_WIF,
    hasBurnWif: !!BURN_WIF,
  }
} 