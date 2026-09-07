import { timingSafeEqual } from "node:crypto";
import { parseCanonicalAppOrigin } from "@/src/application/config/canonical-app-origin";
import { PROXY_TOKEN_HEADER } from "@/src/application/http/canonical-proxy";

export class TrustedProxyConfigError extends Error {
  constructor() {
    super("Trusted request configuration is invalid.");
    this.name = "TrustedProxyConfigError";
  }
}

export function parseTrustedProxySecret(value: unknown): Uint8Array {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new TrustedProxyConfigError();
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== value) {
    bytes.fill(0);
    throw new TrustedProxyConfigError();
  }
  return bytes;
}

export function createTrustedProxyVerifier(canonicalOrigin: string, secret: unknown): (headers: Headers) => boolean {
  const hostname = new URL(parseCanonicalAppOrigin(canonicalOrigin)).hostname;
  const expected = parseTrustedProxySecret(secret);
  return (headers) => {
    let received: Uint8Array;
    try { received = parseTrustedProxySecret(headers.get(PROXY_TOKEN_HEADER)); } catch { return false; }
    let credentialMatches: boolean;
    try { credentialMatches = timingSafeEqual(expected, received); } finally { received.fill(0); }
    return credentialMatches
      && headers.get("host") === hostname
      && headers.get("x-forwarded-host") === hostname
      && headers.get("x-forwarded-proto") === "https"
      && headers.get("x-forwarded-port") === "443";
  };
}
