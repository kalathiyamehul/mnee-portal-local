import { P2PKH, PrivateKey, PublicKey, Transaction, TransactionOutput } from "@bsv/sdk"
import { applyTransferInscription, createDeployTransferInscription, createTransferInscription } from "../transaction/helper/utils"
import { Inscription } from "../types/inscription"
import CosignTemplate from "../transaction/template/cosign"

export const createMintOp = async (
    amount: bigint,
    latestDeployedTokenTxHex: string,
    latestDeployedTokenOpIndex: number,
    destinationAddress: string,
    tokenID: string,
    mintPk: PrivateKey,
    approverPubkey: PublicKey,
    totalSupply: bigint,
    currectAvaSupply: bigint,
    MINT_ADDRESS: string
): Promise<{ txHex: string; err: Error | null }> => {
    try {
        let latestDeployedTx = Transaction.fromHex(latestDeployedTokenTxHex)
        let tx = new Transaction()
        tx.addInput({
            sourceTransaction: latestDeployedTx,
            sourceOutputIndex: latestDeployedTokenOpIndex,
            unlockingScriptTemplate: new P2PKH().unlock(mintPk, "all", true)
        })
        let transferFileHex = createTransferInscription(amount, tokenID)
        let transferLockingScript = new CosignTemplate().lock(destinationAddress, approverPubkey)
        let mintOp: TransactionOutput = {
            satoshis: 1,
            lockingScript: applyTransferInscription(transferLockingScript, { dataHex: transferFileHex } as Inscription)
        }
        tx.addOutput(mintOp)
        let fileHex = createDeployTransferInscription(currectAvaSupply, totalSupply, "mint", tokenID)
        let deployTransferLockingScript = new P2PKH().lock(MINT_ADDRESS)
        let deployTxInstanceOp: TransactionOutput = {
            satoshis: 1,
            lockingScript: applyTransferInscription(deployTransferLockingScript, { dataHex: fileHex } as Inscription)
        }
        tx.addOutput(deployTxInstanceOp)
        try {
            console.log("Signing tx...", tx);
            await tx.sign()
            console.log("Tx signed");
        } catch (error) {
            console.error("Error signing tx:", error);
        }
        return {
            txHex: tx.toHex(),
            err: null
        };
    } catch (error) {
        console.error("Error creating mint op:", error);
        return {
            txHex: "",
            err: error as Error
        }
    }
}
