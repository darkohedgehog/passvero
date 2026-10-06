import { createCommercialHttpHandler } from "@/src/application/subscriptions/http";
import { getOnboardingServices } from "@/src/infrastructure/auth/onboarding-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return createCommercialHttpHandler({
    canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy,
    execute: (headers, input) => getOnboardingServices().approve(headers, input),
  })(request);
}
