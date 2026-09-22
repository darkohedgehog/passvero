import "server-only";
import { createAccessRequestTransport } from "@/src/application/auth/access-request-http";
import { getCanonicalAppOrigin } from "../config/canonical-app-origin";
import { verifyRuntimeProxy } from "../http/trusted-proxy-runtime";
import { getProductionPrismaClient } from "../persistence/prisma/production-prisma-runtime";
import { PrismaAccessRequests } from "../persistence/prisma/prisma-access-requests";
import { createBusinessAuthAbuseService } from "./auth-abuse-runtime";
import { createRuntimeTurnstileVerifier } from "./turnstile-provider-runtime";

export async function submitAccessRequest(request: Request): Promise<Response> {
  try {
    const value = process.env.AUTH_ABUSE_HMAC_SECRET;
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("Invalid configuration");
    const key = Buffer.from(value, "base64url");
    if (key.length !== 32 || key.toString("base64url") !== value) throw new Error("Invalid configuration");
    const abuse = createBusinessAuthAbuseService({ hmacSecret: key });
    const repository = new PrismaAccessRequests(getProductionPrismaClient());
    return await createAccessRequestTransport({ canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy, abuse, turnstileVerifier: createRuntimeTurnstileVerifier(), submit: input => repository.submit(input) })(request);
  } catch { return Response.json({ status: "OPERATIONAL_FAILURE" }, { status: 503, headers: { "cache-control": "no-store" } }); }
}
