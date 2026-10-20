export const MAX_NAME_LENGTH = 10;

export function normalizeName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.trim();
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) return null;
  return name;
}
