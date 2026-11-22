/** Glob match where `*` = any chars, `?` = one char (Apple legacy + component syntax). */
export function globMatch(pattern: string, value: string): boolean {
  const re = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return re.test(value);
}

export function normalizeFingerprint(fp: string): string | null {
  const hex = fp.replace(/[:\s-]/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) return null;
  return hex.match(/.{2}/g)!.join(":");
}
