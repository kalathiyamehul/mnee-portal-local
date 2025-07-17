
export type TokenOperation = "transfer" | "mint" | "deploy+mint" | "burn";
export type ActionType = "deploy" | "mint" | "transfer" | "redeem" | "burn";

export interface BaseTokenInscription {
  p: "bsv-20";
  amt: string;
  op: TokenOperation;
  dec?: string;
}

export interface TokenMetadata {
  currentSupply: string;
  action: ActionType;
  version: "v2";
}

export interface DeployMintTokenInscription extends BaseTokenInscription {
  op: TokenOperation;
  sym: string;
  icon: string;
  metadata: TokenMetadata;
}

export interface TransferTokenInscription extends BaseTokenInscription {
  p: "bsv-20";
  amt: string;
  op: "transfer" | "burn";
}

export interface TransferBSV21Inscription extends TransferTokenInscription {
  id: string;
}

export interface DeployTransferBSV21Inscription extends TransferTokenInscription {
  id: string;
  metadata: TokenMetadata;
}