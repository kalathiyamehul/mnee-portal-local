import { Transaction, OP, Utils, Hash } from '@bsv/sdk';

export function parseCosignerScripts(scripts: any) {
    return scripts.map((script: any) => {
        const chunks = script.chunks;
        for (let i = 0; i <= chunks.length - 4; i++) {
            if (
                chunks.length > i + 6 &&
                chunks[i].op === OP.OP_DUP &&
                chunks[i + 1].op === OP.OP_HASH160 &&
                chunks[i + 2].data?.length === 20 &&
                chunks[i + 3].op === OP.OP_EQUALVERIFY &&
                chunks[i + 4].op === OP.OP_CHECKSIGVERIFY &&
                chunks[i + 5].data?.length === 33 &&
                chunks[i + 6].op === OP.OP_CHECKSIG
            ) {
                return {
                    cosigner: Utils.toHex(chunks[i + 5].data),
                    address: Utils.toBase58Check(chunks[i + 2].data, [0]),
                };
            } else if (
                chunks[i].op === OP.OP_DUP &&
                chunks[i + 1].op === OP.OP_HASH160 &&
                chunks[i + 2].data?.length === 20 &&
                chunks[i + 3].op === OP.OP_EQUALVERIFY &&
                chunks[i + 4].op === OP.OP_CHECKSIG
            ) {
                return {
                    cosigner: '',
                    address: Utils.toBase58Check(chunks[i + 2].data, [0]),
                };
            }
        }
    });
}
export function parseInscription(script: any) {
    let fromPos;
    for (let i = 0; i < script.chunks.length; i++) {
        const chunk = script.chunks[i];
        if (
            i >= 2 &&
            chunk.data?.length === 3 &&
            Utils.toUTF8(chunk.data) === 'ord' &&
            script.chunks[i - 1].op === OP.OP_IF &&
            script.chunks[i - 2].op === OP.OP_FALSE
        ) {
            fromPos = i + 1;
        }
    }
    if (fromPos === undefined) return;

    const insc:any = { file: { hash: '', size: 0, type: '' }, fields: {} };

    for (let i = fromPos; i < script.chunks.length; i += 2) {
        const field = script.chunks[i];
        if (field.op === OP.OP_ENDIF) break;
        if (field.op > OP.OP_16) return;
        const value = script.chunks[i + 1];
        if (value.op > OP.OP_PUSHDATA4) return;

        let fieldNo = 0;
        if (field.op > OP.OP_PUSHDATA4 && field.op <= OP.OP_16) {
            fieldNo = field.op - 80;
        } else if (field.data?.length) {
            fieldNo = field.data[0];
        }

        switch (fieldNo) {
            case 0:
                insc.file.size = value.data?.length || 0;
                if (value.data?.length) {
                    insc.file.hash = Utils.toBase64(Hash.sha256(value.data));
                    insc.file.content = value.data;
                }
                break;
            case 1:
                insc.file.type = Buffer.from(value.data || []).toString();
                break;
        }
    }

    return insc;
}
export const parseTransaction = async (id: any) => {
    let tx = Transaction.fromHex(id);
    const outScripts = tx.outputs.map((output: any) => output.lockingScript);
    const sourceTxs = tx.inputs.map((input: any) => ({
        txid: input.sourceTXID,
        vout: input.sourceOutputIndex,
    }));

    const cosigners = parseCosignerScripts(outScripts);
    // Parse inscriptions from all outputs
    const inscriptions = [];
    for (const script of outScripts) {
        const insc: any = parseInscription(script);
        if (insc?.file?.content) {
            const inscriptionData = Utils.toUTF8(insc.file.content);
            if (inscriptionData) {
                try {
                    const inscriptionJson = JSON.parse(inscriptionData);
                    inscriptions.push(inscriptionJson);
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
    }
    return {
        vin: sourceTxs,
        cosigners,
        inscriptions,
        outputIndex: tx.outputs.length - 1
    };
}