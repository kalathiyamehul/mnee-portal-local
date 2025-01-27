'use server'

import { getMintWif, getBurnWif } from '@/env'

export async function checkServerEnvVars() {
  return {
    hasMintWif: !!getMintWif(),
    hasBurnWif: !!getBurnWif(),
  }
} 