export interface FundingUtxo {
  txid: string;
  vout: number;
  locking_script: string;
  satoshis: number;
}

export interface MintRequest {
  amount: number;
  latest_minter_tx?: string;
  token_ls: string;
  funding_utxos?: FundingUtxo[];
  fee_per_kb?: number;
  change_addr?: string;
}