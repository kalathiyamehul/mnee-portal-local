// src/types/bsv21.ts

export interface BSV21 {
  txid: string;
  vout: number;
  height: number;
  idx: string;
  included: boolean;
  fundTotal: string;
  fundUsed: string;
  fundBalance: string;
  id: string;
  sym: string;
  icon: string;
  amt: string;
  dec: number;
  accounts: number;
  fundAddress: string;
  data: {
    insc: {
      file: {
        hash: string;
        size: number;
        type: string;
      };
      json: {
        p: string;
        op: string;
        amt: string;
        dec: string;
        sym: string;
        icon: string;
      };
    };
    bsv20: {
      id: string;
      op: string;
      amt: number;
      listing: boolean;
    };
    types: string[];
  };
}