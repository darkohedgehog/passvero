import "server-only";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { createTrustedProxyVerifier } from "./trusted-proxy";

let verifier: ((headers: Headers) => boolean) | undefined;

// Lazy: static metadata builds must not require this credential.
export function verifyRuntimeProxy(headers: Headers): boolean {
  verifier ??= createTrustedProxyVerifier(getCanonicalAppOrigin(), process.env.PASSVERO_TRUSTED_PROXY_SECRET);
  return verifier(headers);
}
