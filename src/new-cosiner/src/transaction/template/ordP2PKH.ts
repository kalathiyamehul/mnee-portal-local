import {
  LockingScript,
  P2PKH,
  type Script,
} from "@bsv/sdk";
import { Inscription } from "../../types/inscription";

/**
 * OrdP2PKH (1Sat Ordinal + Pay To Public Key Hash) class extending the standard P2PKH script.
 * Adds the ability to embed ordinal inscriptions into the locking script.
 */
export default class OrdP2PKH extends P2PKH {
  /**
   * Generates a locking script that includes an inscription along with a standard P2PKH script.
   *
   * @param address - Destination address for the Ordinal.
   * @param inscription - Base64 encoded file data and content type.
   * @returns LockingScript including the ordinal inscription.
   * @throws Error if inscription or required fields are missing.
   */
  lock(address: string, inscription?: Inscription): Script {
    if (!inscription?.dataHex) {
      throw new Error("Cannot create inscription: missing contentType or dataHex.");
    }

    const baseLockingScript = super.lock(address);
    return applyInscription(baseLockingScript, inscription);
  }
}

/**
 * Applies an inscription to a standard locking script using ordinal encoding.
 *
 * @param lockingScript - The original locking script.
 * @param inscription - The inscription to embed.
 * @returns A new LockingScript with the inscription applied.
 */
export const applyInscription = (
  lockingScript: LockingScript,
  inscription: Inscription
): LockingScript => {
  
  const ordinalHex = "6f7264"; 
  const mediaTypeHex = "6170706c69636174696f6e2f6273762d3230";

  const ordAsm = `OP_0 OP_IF ${ordinalHex} OP_1 ${mediaTypeHex} OP_0 ${inscription.dataHex} OP_ENDIF`;
  const combinedAsm = `${ordAsm} ${lockingScript.toASM()}`;

  return LockingScript.fromASM(combinedAsm);
};
