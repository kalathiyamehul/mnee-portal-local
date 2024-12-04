import type { FundingUtxo } from "./types/utxo";

export type Config = {
    tokenId: string;
    decimals: number;
    approver: string;
    feeAddress: string;
    fundingUtxos: FundingUtxo[];
    fees: {
        min: number;
        max: number;
        fee: number;
    }[];
};

export type MNEEUtxo = {
    height: number;
    idx: number;
    script: string;
    outpoint: string;
    txid: string;
    vout: number;
    satoshis: number;
    data: {
        bsv21: {
            amt: number;
            dec: number;
            icon: string;
            id: string;
            op: string;
            sym: string;
        };
    }
};