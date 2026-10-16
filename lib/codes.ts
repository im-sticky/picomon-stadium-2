export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const CODE_LENGTH = 4;
// 31 symbols: accept only bytes below 248 (31 * 8) to avoid modulo bias.
const REJECT_THRESHOLD = 256 - (256 % CODE_ALPHABET.length);

export function generateCode(): string {
  let out = "";
  const buf = new Uint8Array(1);
  while (out.length < CODE_LENGTH) {
    crypto.getRandomValues(buf);
    if (buf[0] < REJECT_THRESHOLD) {
      out += CODE_ALPHABET[buf[0] % CODE_ALPHABET.length];
    }
  }
  return out;
}

export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) {
    if (!CODE_ALPHABET.includes(ch)) return null;
  }
  return code;
}
