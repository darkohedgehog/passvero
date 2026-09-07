export type CanonicalOriginErrorCode =
  | "ORIGIN_MISSING" | "ORIGIN_PADDED" | "ORIGIN_MALFORMED"
  | "ORIGIN_SCHEME" | "ORIGIN_SHAPE";

export class CanonicalOriginError extends Error {
  constructor(readonly code: CanonicalOriginErrorCode) {
    super("Canonical application origin configuration is invalid.");
    this.name = "CanonicalOriginError";
  }
}

export function parseCanonicalAppOrigin(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new CanonicalOriginError("ORIGIN_MISSING");
  if (value !== value.trim()) throw new CanonicalOriginError("ORIGIN_PADDED");
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new CanonicalOriginError("ORIGIN_MALFORMED"); }
  if (parsed.protocol !== "https:") throw new CanonicalOriginError("ORIGIN_SCHEME");
  // URL normalizes dot segments, backslashes and empty delimiters; reject those
  // shapes before accepting its normalized origin.
  if (!/^https:\/\/[^/]+\/?$/i.test(value) || /[\s?#\\]/u.test(value)
    || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new CanonicalOriginError("ORIGIN_SHAPE");
  }
  return parsed.origin;
}
