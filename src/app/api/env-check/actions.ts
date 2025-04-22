'use server'

import { getMintWif, getBurnWif } from '@/env'

export const checkServerEnvVars = async () =>  ({
  hasMintWif: !!(await getMintWif().catch(() => false)),
  hasBurnWif: !!(await getBurnWif().catch(() => false)),
})