import { createCommercialHttpHandler } from "@/src/application/subscriptions/http";
import { getCommercialServices } from "@/src/infrastructure/subscriptions/commercial-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return createCommercialHttpHandler({
    canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy,
    execute: (headers, input) => getCommercialServices().request(headers, input),
  })(request);
}
