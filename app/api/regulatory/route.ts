import { createCommercialHttpHandler } from "@/src/application/subscriptions/http";
import { getRegulatoryService, regulatoryActor } from "@/src/infrastructure/subscriptions/regulatory-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return createCommercialHttpHandler({ canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy,
    execute: async (headers, input) => getRegulatoryService().classify(await regulatoryActor(headers), input),
  })(request);
}
