import { z } from "zod";
import { canonicalProxyDenial, type CanonicalProxyDependencies } from "../http/canonical-proxy";
import { accessRequestSchema, type AccessRequestInput } from "./access-request";
import { createAuthAbuseService } from "./auth-abuse-service";
import { completeRiskTriggeredTurnstile, type TurnstileVerifier } from "./turnstile";

type Abuse = ReturnType<typeof createAuthAbuseService>;
const schema = accessRequestSchema.extend({ turnstileToken: z.string().min(1).max(2048).optional() });
export function createAccessRequestTransport(dependencies: CanonicalProxyDependencies & {
  abuse: Pick<Abuse, "checkBeforeAttempt">;
  turnstileVerifier: TurnstileVerifier;
  submit(input: AccessRequestInput): Promise<void>;
}) {
  return async (request: Request): Promise<Response> => {
    const denied = canonicalProxyDenial(request, dependencies, "DENIED");
    if (denied) return denied;
    try {
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return json("INVALID_REQUEST", 400);
      const body = schema.safeParse(await readBoundedJson(request));
      if (!body.success) return json("INVALID_REQUEST", 400);
      const { turnstileToken, ...input } = body.data;
      const decision = await dependencies.abuse.checkBeforeAttempt({ endpoint: "REQUEST_ACCESS", accountIdentifier: input.email });
      if (decision.status === "BLOCK") return json("TEMPORARILY_UNAVAILABLE", 429, decision.retryAfterSeconds);
      const challenge = await completeRiskTriggeredTurnstile({ decision, endpoint: "REQUEST_ACCESS", token: turnstileToken, verifier: dependencies.turnstileVerifier });
      if (challenge.status !== "PROCEED") return json(challenge.status === "DENIED" ? "ADDITIONAL_VERIFICATION_REQUIRED" : "OPERATIONAL_FAILURE", challenge.status === "DENIED" ? 403 : 503);
      await dependencies.submit(input);
      return json("RECEIVED", 202);
    } catch { return json("OPERATIONAL_FAILURE", 503); }
  };
}
async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 8192) { await reader.cancel(); return null; }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return null; } finally { reader.releaseLock(); }
}
function json(status: string, code: number, retry?: number) {
  return Response.json({ status }, { status: code, headers: { "cache-control": "no-store", ...(retry ? { "retry-after": String(retry) } : {}) } });
}
