import {
    BigNumber,
    fromUtxo,
    Hash,
    LockingScript,
    OP,
    P2PKH,
    PrivateKey,
    PublicKey,
    Script,
    ScriptTemplate,
    Transaction,
    TransactionSignature,
    UnlockingScript,
    Utils,
} from '@bsv/sdk'
import { applyInscription, DeployMintTokenInscription, Inscription, TransferTokenInscription, Utxo } from 'js-1sat-ord';
import { vaultPrefixBin, vaultPrefixScript, vaultSuffixHex, vaultSuffixScript } from './constants';

export interface Bsv21VaultParams {
    id: string
    sym: string
    totalSupply: bigint
    dec: number
    // issuer: PublicKey
    remainingSupply: bigint
    // icon: string
}

export class Bsv21Vault implements ScriptTemplate {
    public id: string = ''
    public sym: string = ''
    public totalSupply: bigint = 0n
    public dec: number = 0
    public remainingSupply = 0n
    
    constructor(public issuer: PublicKey, params: Bsv21VaultParams, public sourceTx?: Transaction) {
        this.id = params.id
        this.sym = params.sym
        this.totalSupply = params.totalSupply
        this.dec = params.dec
        this.remainingSupply = params.remainingSupply
    }

    static fromTx(tx: Transaction): Bsv21Vault {
        const chunks = tx.outputs[0].lockingScript.chunks
        if (chunks[0]?.op != OP.OP_FALSE || 
            chunks[1]?.op != OP.OP_IF ||
            Utils.toUTF8(chunks[2].data || []) !== "ord" ||
            chunks[3]?.op != OP.OP_1 ||
            Utils.toUTF8(chunks[4].data || []) !== "application/bsv-20" ||
            chunks[5]?.op != OP.OP_0 ||
            !chunks[6]?.data ||
            chunks[7]?.op != OP.OP_ENDIF
        ) {
            throw new Error('invalid inscription')
        }

        let {id, op, amt} = JSON.parse(Utils.toUTF8(chunks[6].data))
        if (op == "deploy+mint") {
            id = `${tx.id('hex')}_0`
        }
        const remainingSupply = BigInt(amt)
        const conScript = new Script(chunks.slice(8))
        const conScriptBin = conScript.toBinary()
        
        if (!vaultPrefixBin.every((c, i) => c == conScriptBin[i])) {
            throw new Error('mismatched prefix')
        }
        const paramPos = 8 + vaultPrefixScript.chunks.length
        if (chunks.length < paramPos + 5) {
            throw new Error('Invalid Bsv21Vault inscription')
        }
        const pChunks = chunks.slice(paramPos, paramPos + 5)
        
        // const id = Utils.toUTF8(pChunks[0].data || [])
        const sym = Utils.toUTF8(pChunks[1].data || [])
        let reader = new Utils.Reader(pChunks[2].data || [])
        const totalSupply = BigInt(reader.readUInt64LEBn().toString(10))
        reader = new Utils.Reader(pChunks[3].data || [])
        const dec = reader.readUInt32LE()
        const issuer = PublicKey.fromString(Utils.toHex(pChunks[4].data || []))
        
        return new Bsv21Vault(
            issuer, 
            {id, sym, totalSupply, dec, remainingSupply},
            tx
        )
    }

    async mint(
        issuerPk: PrivateKey,
        amt: bigint, 
        ownerScript: Script, 
        fundingPk: PrivateKey,
        fundingUtxos: Utxo[],
        changeAddress: string,
    ): Promise<Transaction> {
        if(!this.sourceTx) {
            throw new Error('sourceTx is required')
        }
        const tx = new Transaction();
        tx.addInput({
            sourceTransaction: this.sourceTx,
            sourceOutputIndex: 0,
            unlockingScriptTemplate: this.unlock(issuerPk)
        })
        for(const utxo of fundingUtxos) {
            tx.addInput(fromUtxo(utxo, new P2PKH().unlock(fundingPk)))
        }
        if(this.remainingSupply < amt) {
            throw new Error('insufficient supply')
        }
        this.remainingSupply -= amt
        tx.addOutput({
            satoshis: 1,
            lockingScript: this.lockTransfer(amt)
        })
        tx.addOutput({
            satoshis: 1,
            lockingScript: applyInscription(ownerScript, this.buildTransferInscription(amt))
        })
        tx.addOutput({
            change: true,
            lockingScript: new P2PKH().lock(changeAddress)
        })
        await tx.fee()
        await tx.sign()
        return tx
    }

    lockDeploy(icon?: string): LockingScript {
        const bsv21 = {
            p: "bsv-20",
            op: "deploy+mint",
            sym: this.sym,
            amt: this.totalSupply.toString(),
            dec: this.dec.toString(),
        } as DeployMintTokenInscription
        if (icon) {
            bsv21.icon = icon
        }

        const inscription = {
            dataB64: Buffer.from(JSON.stringify(bsv21)).toString("base64"),
            contentType: "application/bsv-20",
        }

        return this.lock(inscription)

    }

    lockTransfer(amt: bigint): LockingScript {
        return this.lock(this.buildTransferInscription(amt))
    }

    buildTransferInscription(amt: bigint): Inscription {
        const bsv21 = {
            p: "bsv-20",
            op: "transfer",
            id: this.id,
            amt: amt.toString(),
        } as TransferTokenInscription

        return {
            dataB64: Buffer.from(JSON.stringify(bsv21)).toString("base64"),
            contentType: "application/bsv-20",
        }
    }

    lock(inscription: Inscription): LockingScript {
        const lockingScript = new LockingScript()
        lockingScript.writeScript(vaultPrefixScript)
        if (this.id) {
            lockingScript.writeBin(Utils.toArray(this.id, 'utf8'))
        } else {
            lockingScript.writeOpCode(OP.OP_0)
        }
        lockingScript.writeBin(Utils.toArray(this.sym, 'utf8'))
        lockingScript.writeBn(new BigNumber(this.totalSupply.toString(16), 16))
        lockingScript.writeBn(new BigNumber(this.dec.toString(16), 16))
        lockingScript.writeBin(Utils.toArray(this.issuer.toString(), 'hex'))
        lockingScript.writeScript(vaultSuffixScript)
        lockingScript.writeOpCode(OP.OP_RETURN)

        const scriptWriter = new Utils.Writer([lockingScript.toBinary()])
        const stateScript = new Script()
        if (this.id) {
            stateScript.writeOpCode(OP.OP_FALSE)
            stateScript.writeBin(Utils.toArray(this.id, 'utf8'))
        } else {
            stateScript.writeOpCode(OP.OP_TRUE)
            stateScript.writeOpCode(OP.OP_FALSE)
        }
        stateScript.writeBn(new BigNumber(this.remainingSupply.toString(16), 16))
        const stateBuf = stateScript.toBinary()
        scriptWriter.write(stateBuf)
        scriptWriter.writeInt32LE(stateBuf.length)
        scriptWriter.write([0x00])

        return applyInscription(
            LockingScript.fromBinary(scriptWriter.toArray()), 
            inscription
        )
    }


    /**
     * Creates a function that generates a P2PKH unlocking script along with its signature and length estimation.
     *
     * The returned object contains:
     * 1. `sign` - A function that, when invoked with a transaction and an input index,
     *    produces an unlocking script suitable for a P2PKH locked output.
     * 2. `estimateLength` - A function that returns the estimated length of the unlocking script in bytes.
     *
     * @param {PrivateKey} issuerPrivateKey - The private key used for signing the transaction.
     * @param {'all'|'none'|'single'} signOutputs - The signature scope for outputs.
     * @param {boolean} anyoneCanPay - Flag indicating if the signature allows for other inputs to be added later.
     * @param {number} sourceSatoshis - Optional. The amount being unlocked. Otherwise the input.sourceTransaction is required.
     * @param {Script} lockingScript - Optional. The lockinScript. Otherwise the input.sourceTransaction is required.
     * @returns {Object} - An object containing the `sign` and `estimateLength` functions.
     */
    unlock(
        issuerPrivateKey: PrivateKey,
        signOutputs: 'all' | 'none' | 'single' = 'all',
        anyoneCanPay: boolean = false,
        sourceSatoshis?: number,
        lockingScript?: Script
    ): {
        sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>
        estimateLength: () => Promise<23600>
    } {
        return {
            sign: async (tx: Transaction, inputIndex: number) => {
                let signatureScope = TransactionSignature.SIGHASH_FORKID
                if (signOutputs === 'all') {
                    signatureScope |= TransactionSignature.SIGHASH_ALL
                }
                if (signOutputs === 'none') {
                    signatureScope |= TransactionSignature.SIGHASH_NONE
                }
                if (signOutputs === 'single') {
                    signatureScope |= TransactionSignature.SIGHASH_SINGLE
                }
                if (anyoneCanPay) {
                    signatureScope |= TransactionSignature.SIGHASH_ANYONECANPAY
                }

                const input = tx.inputs[inputIndex]

                const otherInputs = tx.inputs.filter(
                    (_, index) => index !== inputIndex
                )

                const sourceTXID = input.sourceTXID
                    ? input.sourceTXID
                    : input.sourceTransaction?.id('hex')
                if (!sourceTXID) {
                    throw new Error(
                        'The input sourceTXID or sourceTransaction is required for transaction signing.'
                    )
                }
                sourceSatoshis ||=
                    input.sourceTransaction?.outputs[input.sourceOutputIndex]
                        .satoshis
                if (!sourceSatoshis) {
                    throw new Error(
                        'The sourceSatoshis or input sourceTransaction is required for transaction signing.'
                    )
                }
                lockingScript ||=
                    input.sourceTransaction?.outputs[input.sourceOutputIndex]
                        .lockingScript
                if (!lockingScript) {
                    throw new Error(
                        'The lockingScript or input sourceTransaction is required for transaction signing.'
                    )
                }

                const preimage = TransactionSignature.format({
                    sourceTXID,
                    sourceOutputIndex: input.sourceOutputIndex,
                    sourceSatoshis,
                    transactionVersion: tx.version,
                    otherInputs,
                    inputIndex,
                    outputs: tx.outputs,
                    inputSequence: input.sequence || 0xffffffff,
                    subscript: lockingScript,
                    lockTime: tx.lockTime,
                    scope: signatureScope,
                })
                const rawSignature = issuerPrivateKey.sign(
                    Hash.sha256(preimage)
                )
                const sig = new TransactionSignature(
                    rawSignature.r,
                    rawSignature.s,
                    signatureScope
                )

                const payOutput = tx.outputs[1]
                const tokenLS = new Script(payOutput.lockingScript.chunks.slice(8)).toBinary()
                if (!payOutput.lockingScript.chunks[7].data) {
                    throw new Error('Token amount not found in the locking script')
                }
                const {amt} = JSON.parse(Utils.toUTF8(payOutput.lockingScript.chunks[7].data))
                const changeOutput = tx.outputs[2]
                if (!changeOutput.lockingScript.chunks[2].data) {
                    throw new Error('Change output must be to a P2PKH output')
                }

                const unlockScript = new UnlockingScript()
                unlockScript.writeBin(sig.toChecksigFormat())
                unlockScript.writeBin(tokenLS)
                unlockScript.writeBn(new BigNumber(amt, 10))
                unlockScript.writeBin(preimage)
                unlockScript.writeBn(new BigNumber(changeOutput.satoshis))
                unlockScript.writeBin(changeOutput.lockingScript.chunks[2].data)
                return unlockScript
            },
            estimateLength: async () => {
                // public key (1+33) + signature (1+73) + approver signature (1+73)
                // Note: We add 1 to each element's length because of the associated OP_PUSH
                return 23600
            },
        }
    }
}

