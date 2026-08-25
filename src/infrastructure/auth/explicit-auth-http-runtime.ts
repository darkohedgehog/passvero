import "server-only";

import { createExplicitAuthHttpTransport } from "@/src/application/auth/explicit-auth-http-transport";
import { createBusinessAuthAbuseService } from "@/src/infrastructure/auth/auth-abuse-runtime";
import { getBetterAuthServer } from "@/src/infrastructure/auth/better-auth-server";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
import { resolveCurrentUserFromProviderSession } from "@/src/infrastructure/auth/provider-neutral-session-resolution";
import { createStage13c4AuthLifecycle } from "@/src/infrastructure/auth/stage13c4-auth-lifecycle";
import { createRuntimeTurnstileVerifier } from "@/src/infrastructure/auth/turnstile-provider-runtime";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Transport = ReturnType<typeof createExplicitAuthHttpTransport>;
const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroExplicitAuthHttpTransport?: Transport;
};

export function getExplicitAuthHttpTransport(): Transport {
  runtimeGlobal.__passveroExplicitAuthHttpTransport ??= createRuntime();
  return runtimeGlobal.__passveroExplicitAuthHttpTransport;
}

function createRuntime(): Transport {
  const config = validateBetterAuthServerConfig({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
  });
  const lifecycle = createStage13c4AuthLifecycle({
    activationCapabilityKey: readKey(process.env.AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET),
    activationEmailKey: readKey(process.env.AUTH_ACTIVATION_EMAIL_HMAC_SECRET),
  });
  const abuse = createBusinessAuthAbuseService({
    hmacSecret: readKey(process.env.AUTH_ABUSE_HMAC_SECRET),
  });
  const auth = getBetterAuthServer();

  return createExplicitAuthHttpTransport({
    canonicalOrigin: config.baseURL,
    trustedClientAddress: () => undefined,
    abuse,
    turnstileVerifier: createRuntimeTurnstileVerifier(),
    provider: {
      async signIn(input) {
        const result = await auth.api.signInEmail({
          headers: input.headers,
          body: { email: input.email, password: input.password, rememberMe: false },
          returnHeaders: true,
        });
        return { headers: result.headers };
      },
      async verifyEmail(input) {
        await auth.api.verifyEmail({ query: { token: input.token } });
      },
      async signOut(input) {
        const result = await auth.api.signOut({
          headers: input.headers,
          body: { disableRedirect: true },
          returnHeaders: true,
        });
        return { headers: result.headers };
      },
    },
    lifecycle,
    async resolvePasswordChangeActor(headers) {
      const resolution = await resolveCurrentUserFromProviderSession(headers);
      if (resolution.status !== "AUTHENTICATED") return null;
      const user = await getProductionPrismaClient().user.findUnique({
        where: { id: resolution.currentUser.userId },
        select: { id: true, email: true, displayName: true },
      });
      return user === null ? null : {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        headers,
      };
    },
  });
}

function readKey(value: unknown): Uint8Array {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new Error("Auth HTTP secret configuration is invalid.");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
    decoded.fill(0);
    throw new Error("Auth HTTP secret configuration is invalid.");
  }
  return decoded;
}
