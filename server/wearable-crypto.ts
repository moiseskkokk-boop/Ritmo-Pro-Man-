import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

function keyBytes() {
  const raw = ENV.wearableTokenEncryptionKey.trim();
  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("WEARABLE_TOKEN_ENCRYPTION_KEY must be a 32-byte hex or base64 key");
  return key;
}

export function encryptWearableSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".");
}

export function decryptWearableSecret(envelope: string) {
  const [ivPart, tagPart, dataPart, extra] = envelope.split(".");
  if (!ivPart || !tagPart || !dataPart || extra) throw new Error("Invalid encrypted wearable token envelope");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}
