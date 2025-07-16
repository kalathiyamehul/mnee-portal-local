import { PrivateKey, Transaction, TransactionInput, TransactionOutput } from "@bsv/sdk";
import OrdP2PKH from "../transaction/template/ordP2PKH";
import { createDeployTransferInscription } from "../transaction/helper/utils";
import { Inscription } from "../types/inscription";
import CosignTemplate from "../transaction/template/cosign";


export const createRedeemTx = async (
    latestDeployedTokenTxHex: string,
    latestDeployedTokenOpIndex: number,
    redeemUtxoTxHex: string,
    redeemUtxoIndex: number,
    tokenID: string,
    redeemPk: PrivateKey,
    parsedCurrentSupply: bigint,
    parsedTotalSupply: bigint,
    MINT_ADDRESS: string,
    MINT_WIF: string
): Promise<{ txHex: string; err: Error | null }> => {

    const latestParentDeployedTx = Transaction.fromHex(latestDeployedTokenTxHex)
    const redeemParentTx = Transaction.fromHex(redeemUtxoTxHex)
    let tx = new Transaction()
    const pk = PrivateKey.fromWif(MINT_WIF);

    let deployTxInstanceIp: TransactionInput = {
        sourceTransaction: latestParentDeployedTx,
        sourceOutputIndex: latestDeployedTokenOpIndex,
        unlockingScriptTemplate: new OrdP2PKH().unlock(pk, "all", true)
    }

    tx.addInput(deployTxInstanceIp)

    let redeemTxInstanceIp: TransactionInput = {
        sourceTransaction: redeemParentTx,
        sourceOutputIndex: redeemUtxoIndex,
        unlockingScriptTemplate: new CosignTemplate().userUnlock(redeemPk, "all", true)
    }

    tx.addInput(redeemTxInstanceIp)
    let fileHex = createDeployTransferInscription(parsedCurrentSupply, parsedTotalSupply, "redeem", tokenID)
    let deployTxInstanceOp: TransactionOutput = {
        satoshis: 1,
        lockingScript: new OrdP2PKH().lock(MINT_ADDRESS, {
            dataHex: fileHex
        } as Inscription)
    }

    tx.addOutput(deployTxInstanceOp)

    await tx.sign()

    return {
        txHex: tx.toHex(),
        err: null
    };
}
