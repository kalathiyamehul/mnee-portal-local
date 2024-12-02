
export interface TxoData {
  bsv21: {
    id: string;
    op: string;
    sym: string;
    dec: number;
    icon: string;
    amt: number;
    status: number;
  },
  insc: {
    file: {
      hash: string;
      size: number;
      type: string;
    }
  }
}

export interface Txo {
  outpoint: string;
  height: number;
  idx: number;
  satoshis: number;
  owners: string[];
  data: TxoData;
}

export interface IndexContext {
  txid: string;
  height: number;
  idx: number;
  score: number;
  txos: Txo[];
  spends: Txo[];
}
