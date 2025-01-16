'use server'

import { MINT_WIF, BURN_WIF, MNEE_ORDINALS_SERVICE } from '@/env'

export async function checkServerEnvVars() {
  return {
    hasMintWif: !!MINT_WIF,
    hasBurnWif: !!BURN_WIF,
    hasOrdinalsService: !!MNEE_ORDINALS_SERVICE
  }
} 