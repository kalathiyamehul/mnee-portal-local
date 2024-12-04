export interface FundingUtxo {
  txid: string;
  vout: number;
  locking_script: string;
  satoshis: number;
}