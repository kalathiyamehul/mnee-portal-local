// mnee-tx-parser.js
import { Transaction, Utils } from '@bsv/sdk';
import axios from 'axios';
import { MNEE_API } from '../config/config';
import { parseCosignerScripts, parseInscription } from './helper';

async function fetchRawTx(txid:any) {
    const res = await axios.get(`${MNEE_API}/v1/tx/${txid}`);
    const base64 = res.data?.rawtx || res.data;
    const hex = Buffer.from(base64, 'base64').toString('hex');
    return Transaction.fromHex(hex);
}

export async function parseTransaction(tx: any) {
    const txid = tx.id('hex');
    const outScripts = tx.outputs.map((output: any) => output.lockingScript);
    const sourceTxs = tx.inputs.map((input: any) => ({
        txid: input.sourceTXID,
        vout: input.sourceOutputIndex,
    }));

    const cosigners = parseCosignerScripts(outScripts);
    // Parse inscriptions from all outputs
    const inscriptions = [];
    for (const script of outScripts) {
        const insc = parseInscription(script);
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
        txid,
        vin: sourceTxs,
        cosigners,
        inscriptions,
    };
}

export async function parseTx(txid: any) {
    const tx = await fetchRawTx(txid);
    if (!tx) throw new Error('Failed to fetch transaction');
    return await parseTransaction(tx);
}

