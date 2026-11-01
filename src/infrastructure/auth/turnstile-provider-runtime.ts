import "server-only";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";

import { createLazyCloudflareTurnstileVerifier } from "@/src/infrastructure/auth/cloudflare-turnstile-provider";

export function createRuntimeTurnstileVerifier() {
  return createLazyCloudflareTurnstileVerifier({
    readSecretKey: () => process.env.TURNSTILE_SECRET_KEY,
    readExpectedHostname: () => new URL(getCanonicalAppOrigin()).hostname,
    request: (input, init) => fetch(input, init),
  });
}
