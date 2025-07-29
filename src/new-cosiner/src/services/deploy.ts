import {
	Transaction,
} from "@bsv/sdk";
import { createDeployInstanceInscription, validIconFormat } from "../transaction/helper/utils";
import { Inscription } from "../types/inscription";
import OrdP2PKH from "../transaction/template/ordP2PKH";

export const createDeployOp = (
  iconOutpoint: string,
  tokens: number,
  decimals: number,
  destinationAddress: string,
  symbol: string
): { txHex: string; err: Error | null } => {

  if (!validIconFormat(iconOutpoint)) {
    return {
      txHex: "",
      err: new Error(
        "Invalid icon format. Must be either outpoint (format: txid_vout) or relative output index of the icon (format _vout). Examples: ecb483eda58f26da1b1f8f15b782b1186abdf9c6399a1c3e63e0d429d5092a41_0 or _1"
      )
    };
  }
  const json = {
    iconOutpoint,
    tokens,
    decimals,
    destinationAddress,
    symbol
  }
  console.log("deploy json", JSON.stringify(json, null, 2));
  const tx = new Transaction();

  let fileHex = createDeployInstanceInscription(decimals, tokens, symbol, iconOutpoint, "deploy", "deploy+mint", "0")
  
	const sendTxOut = {
		satoshis: 1,
		lockingScript: new OrdP2PKH().lock(destinationAddress, {
			dataHex: fileHex
		} as Inscription),
	};

	tx.addOutput(sendTxOut);

  return {
    txHex: tx.toHex(),
    err: null
  };
};


