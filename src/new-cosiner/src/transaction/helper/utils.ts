import { LockingScript } from "@bsv/sdk";
import { ActionType, DeployMintTokenInscription, DeployTransferBSV21Inscription, TokenMetadata, TokenOperation, TransferBSV21Inscription } from "../../types/token.types";
import { Inscription } from "../../types/inscription";

export const validIconFormat = (icon: string): boolean => {
    if (!icon.includes("_") || icon.endsWith("_")) {
        return false;
    }

    const iconVout = Number.parseInt(icon.split("_")[1]);
    if (Number.isNaN(iconVout)) {
        return false;
    }

    if (!icon.startsWith("_") && icon.split("_")[0].length !== 64) {
        return false;
    }

    return true;
};


export const createDeployInstanceInscription = (
  decimals: number,
  tokens: number,
  symbol: string,
  iconOutpoint: string,
  action: ActionType,
  op: TokenOperation,
  currentSupply: string
): string => {
  const tsatAmount = decimals
    ? BigInt(tokens) * 10n ** BigInt(decimals)
    : BigInt(tokens);

  const metadata: TokenMetadata = {
    currentSupply: currentSupply,
    action,
    version: "v2",
  };

  const inscription: DeployMintTokenInscription = {
    p: "bsv-20",
    op,
    sym: symbol,
    icon: iconOutpoint,
    amt: tsatAmount.toString(),
    metadata,
  };

  if (decimals) {
    inscription.dec = decimals.toString();
  }

  return Buffer.from(JSON.stringify(inscription)).toString("hex");
};



export const createTransferInscription = (amount: bigint | number, id: string) => {
    const transferInscription: TransferBSV21Inscription = {
			p: "bsv-20",
			op: "transfer",
			amt: amount.toString(),
      id: id,
	};

    const fileHex = Buffer.from(JSON.stringify(transferInscription)).toString("hex");
    return fileHex
}


export const createDeployTransferInscription = (amount: bigint, tsatAmt: bigint, action: ActionType, id: string) => { 
  let metadata: TokenMetadata = {
    currentSupply: tsatAmt.toString(),
    action: action,
    version: "v2"
  }

    const transferInscription: DeployTransferBSV21Inscription = {
			p: "bsv-20",
			op: "transfer",
			amt: amount.toString(),
      id: id,
      metadata: metadata,
	};

    const fileHex = Buffer.from(JSON.stringify(transferInscription)).toString("hex");
    return fileHex
}

export const applyTransferInscription = (lockingScript: LockingScript, inscription: Inscription): LockingScript => {

  const ordinalHex = "6f7264"; 
  const mediaTypeHex = "6170706c69636174696f6e2f6273762d3230";

  const ordAsm = `OP_0 OP_IF ${ordinalHex} OP_1 ${mediaTypeHex} OP_0 ${inscription.dataHex} OP_ENDIF`;
  const combinedAsm = `${ordAsm} ${lockingScript.toASM()}`;

  return LockingScript.fromASM(combinedAsm);

}