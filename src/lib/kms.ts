import { KMSClient, DecryptCommand, EncryptCommand } from "@aws-sdk/client-kms";

const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || "us-west-2",
});

export async function decryptKmsValue(encryptedValue: string): Promise<string> {
  try {
    const decodedValue = Buffer.from(encryptedValue, "base64");
    const command = new DecryptCommand({
      CiphertextBlob: decodedValue,
    });

    const response = await kmsClient.send(command);
    if (!response.Plaintext) {
      throw new Error("Failed to decrypt value");
    }

    return Buffer.from(response.Plaintext).toString("utf-8");
  } catch (error) {
    console.error("Error decrypting value:", error);
    throw error;
  }
}

export async function encryptKmsValue(value: string, description?: string): Promise<string> {
  try {
    const command = new EncryptCommand({
      KeyId: process.env.KMS_KEY_ID,
      Plaintext: Buffer.from(value),
      EncryptionContext: description ? { 
        purpose: description 
      } : undefined
    });

    const response = await kmsClient.send(command);
    if (!response.CiphertextBlob) {
      throw new Error("Failed to encrypt value");
    }

    return Buffer.from(response.CiphertextBlob).toString("base64");
  } catch (error) {
    console.error("Error encrypting value:", error);
    throw error;
  }
} 