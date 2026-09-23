import crypto from "crypto";

function getKey(): Buffer {
  const secret = process.env.EMAIL_ENCRYPTION_KEY;
  if (!secret) throw new Error("EMAIL_ENCRYPTION_KEY não configurada");
  return crypto.createHash("sha256").update(secret).digest();
}

// Formato: iv:tag:conteudo (base64)
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(":");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, enc] = payload.split(":").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
