import { Hash, type PrivateKey, Script, type Transaction, TransactionSignature } from "@bsv/sdk"

export function signMint(tx: Transaction, inputIndex: number, issuerPriv: PrivateKey) {
    const input = tx.inputs[inputIndex]
    if(!input.unlockingScript) {
        throw new Error('Missing unlockingScript')
    }
    const sourceTXID = input.sourceTXID || input.sourceTransaction?.id('hex')
    if (!sourceTXID || !input.sourceTransaction) {
        throw new Error('Missing sourceTransaction')
    }
    const sourceOutput = input.sourceTransaction.outputs[input.sourceOutputIndex];
    const signatureScope = TransactionSignature.SIGHASH_FORKID |
        TransactionSignature.SIGHASH_ALL |
        TransactionSignature.SIGHASH_ANYONECANPAY

    const preimage = TransactionSignature.format({
        sourceTXID,
        sourceOutputIndex: input.sourceOutputIndex,
        sourceSatoshis: sourceOutput.satoshis || 0,
        transactionVersion: tx.version,
        otherInputs: tx.inputs.splice(inputIndex, 1),
        inputIndex,
        outputs: tx.outputs,
        inputSequence: input.sequence || 0xffffffff,
        subscript: sourceOutput.lockingScript,
        lockTime: tx.lockTime,
        scope: signatureScope
    })
    const rawSignature = issuerPriv.sign(Hash.sha256(preimage))
    const sig = new TransactionSignature(
        rawSignature.r,
        rawSignature.s,
        signatureScope
    )
    const unlockingScript = new Script([]).writeBin(sig.toChecksigFormat())
    input.unlockingScript = new Script([
        unlockingScript.chunks[0],
        ...input.unlockingScript.chunks.slice(1)
    ])
    return
}