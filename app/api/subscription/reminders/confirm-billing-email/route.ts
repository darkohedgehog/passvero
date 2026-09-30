import { createCommercialHttpHandler } from "@/src/application/subscriptions/http";
import { getReminderServices } from "@/src/infrastructure/subscriptions/reminder-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return createCommercialHttpHandler({ canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy, execute: (headers, input) => getReminderServices().confirmBillingEmail(headers, input) })(request);
}
