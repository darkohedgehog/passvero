import "server-only";

import { createLazyCloudflareTurnstileVerifier } from "@/src/infrastructure/auth/cloudflare-turnstile-provider";

export function createRuntimeTurnstileVerifier() {
  return createLazyCloudflareTurnstileVerifier({
    readSecretKey: () => process.env.TURNSTILE_SECRET_KEY,
    request: (input, init) => fetch(input, init),
  });
}
