import { PrivateKey, PublicKey, Transaction, TransactionInput, TransactionOutput } from "@bsv/sdk";
import { applyTransferInscription, createTransferInscription } from "../transaction/helper/utils";
import { Inscription } from "../types/inscription";
import CosignTemplate from "../transaction/template/cosign";
import { APPROVER_PUBKEY, MINT_ADDRESS, MINT_WIF } from "../config/config";


export const createMergeSplit = async (transferUtxoTxHex: string, tokenID: string, destinationAddress: string, transferAmt: number, feeAmt: number): Promise<{ txHex: string; err: Error | null} > => {

    const redeemParentTx = Transaction.fromHex(transferUtxoTxHex)
    const redeemPk: PrivateKey = PrivateKey.fromWif('Kzr2AE268vG44QG1jxSdBohe5ofkUezRELn7fyRDM4WCQTJJLKCD')

    let tx = new Transaction()

    for (let i = 0; i < 3; i ++){
    let redeemTxInstanceIp: TransactionInput = {
        sourceTransaction: redeemParentTx,
        sourceOutputIndex: i,
        unlockingScriptTemplate: new CosignTemplate().userUnlock(redeemPk, "all", true)
    }

    tx.addInput(redeemTxInstanceIp)
}

    for (let i = 0; i < 2; i ++){
        let transferFileHex = createTransferInscription(transferAmt, tokenID)
        let transferLockingScript = new CosignTemplate().lock(destinationAddress, PublicKey.fromString(APPROVER_PUBKEY))
        let mintOp: TransactionOutput = {
            satoshis: 1,
            lockingScript: applyTransferInscription(transferLockingScript, { dataHex: transferFileHex } as Inscription)
        }
        tx.addOutput(mintOp)
    }

    let transferFileHex = createTransferInscription(transferAmt-2000, tokenID)
        let transferLockingScript = new CosignTemplate().lock(destinationAddress, PublicKey.fromString(APPROVER_PUBKEY))
        let mintOp: TransactionOutput = {
            satoshis: 1,
            lockingScript: applyTransferInscription(transferLockingScript, { dataHex: transferFileHex } as Inscription)
        }
        tx.addOutput(mintOp)

    let feeFileHex = createTransferInscription(feeAmt, tokenID)
    let feeLockingScript = new CosignTemplate().lock(MINT_ADDRESS, PublicKey.fromString(APPROVER_PUBKEY))
    let feeOp: TransactionOutput = {
        satoshis: 1,
        lockingScript: applyTransferInscription(feeLockingScript, { dataHex: feeFileHex } as Inscription)
    }
    tx.addOutput(feeOp)

    await tx.sign()

    return {
    txHex: tx.toHex(),
    err: null
  };

}