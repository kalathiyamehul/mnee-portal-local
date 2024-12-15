export type Config = {
    id?: number;
    tokenId: string;
    decimals: number;
    approver: string;
    feeAddress: string;
    fees: {
        min: number;
        max: number;
        fee: number;
    }[];
    latestMinterTx: string;
    mintAddress: string;
    burnAddress: string;
    fundAddress: string;
};

export type MNEEUtxo = {
    height: number;
    idx: number;
    script: string;
    outpoint: string;
    txid: string;
    vout: number;
    satoshis: number;
    owners: string[];
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