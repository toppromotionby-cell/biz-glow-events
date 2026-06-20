// Симметричное шифрование паролей IMAP/SMTP перед сохранением в БД.
// Ключ MAIL_ENCRYPTION_KEY (base64, 32 байта) хранится только на сервере.
// Формат шифротекста: "enc:v1:<iv_b64>:<tag_b64>:<ct_b64>".
// Старые plaintext-значения распознаются по отсутствию префикса "enc:v1:" и
// прозрачно читаются (обратная совместимость до первого пересохранения).

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.MAIL_ENCRYPTION_KEY;
  if (!raw) throw new Error("MAIL_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("MAIL_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded AES-256 key)");
  }
  return key;
}

export function encryptMailPassword(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptMailPassword(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) {
    // Legacy plaintext row — вернуть как есть; пересохранение зашифрует.
    return value;
  }
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted mail password");
  const [ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
