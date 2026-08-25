import type { AuthAbuseDecision } from "./auth-abuse-policy";
import type { AuthAbuseEndpoint } from "./auth-abuse-types";
import {
  completeRiskTriggeredTurnstile,
  type TurnstileVerifier,
} from "./turnstile";

type OutcomeResult =
  | Readonly<{ status: "RECORDED" }>
  | Readonly<{ status: "OPERATIONAL_RECONCILIATION_REQUIRED" }>;

type SafeOperationResult = Readonly<{ status: string }>;

export type ExplicitAuthHttpDependencies = Readonly<{
  canonicalOrigin: string;
  trustedClientAddress(request: Request): string | undefined;
  abuse: {
    checkBeforeAttempt(input: {
      endpoint: AuthAbuseEndpoint;
      accountIdentifier?: string;
      trustedClientAddress?: string;
    }): Promise<AuthAbuseDecision>;
    recordOutcome(input: {
      endpoint: AuthAbuseEndpoint;
      accountIdentifier?: string;
      trustedClientAddress?: string;
      outcome: "SUCCESS" | "FAILURE";
    }): Promise<OutcomeResult>;
  };
  turnstileVerifier: TurnstileVerifier;
  provider: {
    signIn(input: { email: string; password: string; headers: Headers }): Promise<{ headers: Headers }>;
    verifyEmail(input: { token: string }): Promise<void>;
    signOut(input: { headers: Headers }): Promise<{ headers: Headers }>;
  };
  lifecycle: {
    activate(input: { capability: string; password: unknown }): Promise<SafeOperationResult>;
    requestEmailVerification(email: string): Promise<void>;
    passwordRecovery: {
      request(email: string): Promise<SafeOperationResult>;
      complete(token: string, newPassword: unknown): Promise<SafeOperationResult>;
    };
    changePassword(actor: {
      userId: string;
      email: string;
      displayName: string | null;
      headers: Headers;
    }, input: { currentPassword: unknown; newPassword: unknown }): Promise<SafeOperationResult>;
  };
  resolvePasswordChangeActor(headers: Headers): Promise<{
    userId: string;
    email: string;
    displayName: string | null;
    headers: Headers;
  } | null>;
}>;

export function createExplicitAuthHttpTransport(
  dependencies: ExplicitAuthHttpDependencies,
) {
  async function protectedOperation(input: {
    request: Request;
    endpoint: AuthAbuseEndpoint;
    accountIdentifier?: string;
    turnstileToken?: string;
    operation(): Promise<{ success: boolean; response: Response; headers?: Headers }>;
  }): Promise<Response> {
    const trustedClientAddress = dependencies.trustedClientAddress(input.request);
    const attempt = {
      endpoint: input.endpoint,
      ...(input.accountIdentifier === undefined ? {} : { accountIdentifier: input.accountIdentifier }),
      ...(trustedClientAddress === undefined ? {} : { trustedClientAddress }),
    };
    const decision = await dependencies.abuse.checkBeforeAttempt(attempt);
    if (decision.status === "BLOCK") {
      return json({ status: "TEMPORARILY_UNAVAILABLE" }, 429, undefined, decision.retryAfterSeconds);
    }
    const challenge = await completeRiskTriggeredTurnstile({
      decision,
      endpoint: input.endpoint,
      token: input.turnstileToken,
      trustedClientAddress,
      verifier: dependencies.turnstileVerifier,
    });
    if (challenge.status !== "PROCEED") {
      return json({ status: challenge.status === "DENIED"
        ? "ADDITIONAL_VERIFICATION_REQUIRED"
        : "OPERATIONAL_FAILURE" }, challenge.status === "DENIED" ? 403 : 503);
    }

    let result: Awaited<ReturnType<typeof input.operation>>;
    try {
      result = await input.operation();
    } catch {
      result = { success: false, response: json({ status: "AUTHENTICATION_FAILED" }, 401) };
    }
    const outcome = await dependencies.abuse.recordOutcome({
      ...attempt,
      outcome: result.success ? "SUCCESS" : "FAILURE",
    });
    if (outcome.status !== "RECORDED") {
      return json({ status: "OPERATIONAL_FAILURE" }, 503, result.headers);
    }
    return result.response;
  }

  return {
    async signIn(request: Request): Promise<Response> {
      if (!validPostOrigin(request, dependencies.canonicalOrigin)) return json({ status: "DENIED" }, 403);
      const body = await readPost(request, dependencies.canonicalOrigin, ["email", "password", "turnstileToken"]);
      if (body === null || !boundedString(body.email, 1, 254) || !boundedString(body.password, 1, 256)
        || !optionalString(body.turnstileToken, 2048)) return json({ status: "INVALID_REQUEST" }, 400);
      return protectedOperation({
        request,
        endpoint: "SIGN_IN",
        accountIdentifier: body.email,
        turnstileToken: body.turnstileToken as string | undefined,
        async operation() {
          try {
            const provider = await dependencies.provider.signIn({
              email: body.email as string,
              password: body.password as string,
              headers: request.headers,
            });
            return { success: true, response: json({ status: "AUTHENTICATED" }, 200, provider.headers), headers: provider.headers };
          } catch {
            return { success: false, response: json({ status: "AUTHENTICATION_FAILED" }, 401) };
          }
        },
      });
    },

    async activate(request: Request): Promise<Response> {
      if (!validPostOrigin(request, dependencies.canonicalOrigin)) return json({ status: "DENIED" }, 403);
      const body = await readPost(request, dependencies.canonicalOrigin, ["capability", "password", "turnstileToken"]);
      if (body === null || !boundedString(body.capability, 43, 43) || !boundedString(body.password, 1, 256)
        || !optionalString(body.turnstileToken, 2048)) return json({ status: "INVALID_REQUEST" }, 400);
      return protectedOperation({ request, endpoint: "ACTIVATE_ACCOUNT", turnstileToken: body.turnstileToken as string | undefined,
        operation: async () => {
          const result = await dependencies.lifecycle.activate({ capability: body.capability as string, password: body.password });
          const success = ["VERIFICATION_PENDING", "ALREADY_BOUND"].includes(result.status);
          return { success, response: json({ status: success ? "ACTIVATION_ACCEPTED" : "ACTIVATION_DENIED" }, success ? 202 : 400) };
        } });
    },

    async requestEmailVerification(request: Request): Promise<Response> {
      return genericRequest(request, "EMAIL_VERIFICATION_REQUEST", async (email) => {
        await dependencies.lifecycle.requestEmailVerification(email);
        return true;
      });
    },

    async consumeEmailVerification(request: Request): Promise<Response> {
      if (!sameRequestOrigin(request, dependencies.canonicalOrigin)) return json({ status: "DENIED" }, 403);
      const url = new URL(request.url);
      const token = url.searchParams.getAll("token");
      if (token.length !== 1 || !boundedString(token[0], 1, 2048) || [...url.searchParams.keys()].some((key) => key !== "token")) {
        return json({ status: "INVALID_REQUEST" }, 400);
      }
      return protectedOperation({ request, endpoint: "EMAIL_VERIFICATION_CONSUME", operation: async () => {
        try { await dependencies.provider.verifyEmail({ token: token[0] }); return { success: true, response: json({ status: "VERIFIED" }, 200) }; }
        catch { return { success: false, response: json({ status: "VERIFICATION_DENIED" }, 400) }; }
      } });
    },

    async requestPasswordReset(request: Request): Promise<Response> {
      return genericRequest(request, "PASSWORD_RESET_REQUEST", async (email) => {
        const result = await dependencies.lifecycle.passwordRecovery.request(email);
        return result.status === "REQUEST_ACCEPTED";
      });
    },

    async consumePasswordReset(request: Request): Promise<Response> {
      if (!validPostOrigin(request, dependencies.canonicalOrigin)) return json({ status: "DENIED" }, 403);
      const body = await readPost(request, dependencies.canonicalOrigin, ["token", "newPassword", "turnstileToken"]);
      if (body === null || !boundedString(body.token, 1, 2048) || !boundedString(body.newPassword, 1, 256)
        || !optionalString(body.turnstileToken, 2048)) return json({ status: "INVALID_REQUEST" }, 400);
      return protectedOperation({ request, endpoint: "PASSWORD_RESET_CONSUME", turnstileToken: body.turnstileToken as string | undefined,
        operation: async () => {
          const result = await dependencies.lifecycle.passwordRecovery.complete(body.token as string, body.newPassword);
          const success = result.status === "PASSWORD_RESET";
          return { success, response: json({ status: success ? "PASSWORD_RESET" : "RESET_DENIED" }, success ? 200 : 400) };
        } });
    },

    async changePassword(request: Request): Promise<Response> {
      if (!validPostOrigin(request, dependencies.canonicalOrigin)) return json({ status: "DENIED" }, 403);
      const body = await readPost(request, dependencies.canonicalOrigin, ["currentPassword", "newPassword", "turnstileToken"]);
      if (body === null || !boundedString(body.currentPassword, 1, 256) || !boundedString(body.newPassword, 1, 256)
        || !optionalString(body.turnstileToken, 2048)) return json({ status: "INVALID_REQUEST" }, 400);
      const actor = await dependencies.resolvePasswordChangeActor(request.headers);
      if (actor === null) return json({ status: "UNAUTHENTICATED" }, 401);
      return protectedOperation({ request, endpoint: "PASSWORD_CHANGE", accountIdentifier: actor.email,
        turnstileToken: body.turnstileToken as string | undefined, operation: async () => {
          const result = await dependencies.lifecycle.changePassword(actor, { currentPassword: body.currentPassword, newPassword: body.newPassword });
          const success = result.status === "PASSWORD_CHANGED";
          return { success, response: json({ status: success ? "PASSWORD_CHANGED" : "PASSWORD_CHANGE_DENIED" }, success ? 200 : 400) };
        } });
    },

    async signOut(request: Request): Promise<Response> {
      if (!validPostOrigin(request, dependencies.canonicalOrigin)) return json({ status: "DENIED" }, 403);
      try {
        const provider = await dependencies.provider.signOut({ headers: request.headers });
        return json({ status: "SIGNED_OUT" }, 200, provider.headers);
      } catch { return json({ status: "SIGNED_OUT" }, 200); }
    },
  };

  async function genericRequest(request: Request, endpoint: AuthAbuseEndpoint, operation: (email: string) => Promise<boolean>) {
    if (!validPostOrigin(request, dependencies.canonicalOrigin)) return json({ status: "DENIED" }, 403);
    const body = await readPost(request, dependencies.canonicalOrigin, ["email", "turnstileToken"]);
    if (body === null || !boundedString(body.email, 1, 254) || !optionalString(body.turnstileToken, 2048)) {
      return json({ status: "INVALID_REQUEST" }, 400);
    }
    return protectedOperation({ request, endpoint, accountIdentifier: body.email as string,
      turnstileToken: body.turnstileToken as string | undefined, operation: async () => {
        let success = false;
        try { success = await operation(body.email as string); } catch { /* generic outward response */ }
        return { success, response: json({ status: "ACCEPTED" }, 202) };
      } });
  }
}

async function readPost(request: Request, origin: string, allowed: readonly string[]): Promise<Record<string, unknown> | null> {
  if (!validPostOrigin(request, origin) || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return null;
  let text: string;
  try { text = await request.text(); } catch { return null; }
  if (text.length === 0 || text.length > 4096) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => allowed.includes(key)) ? record : null;
}

function validPostOrigin(request: Request, origin: string): boolean {
  return request.method === "POST" && sameRequestOrigin(request, origin) && request.headers.get("origin") === origin;
}
function sameRequestOrigin(request: Request, origin: string): boolean {
  try { return new URL(request.url).origin === origin; } catch { return false; }
}
function boundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && [...value].length >= minimum && [...value].length <= maximum;
}
function optionalString(value: unknown, maximum: number): boolean {
  return value === undefined || boundedString(value, 1, maximum);
}
function json(body: object, status: number, providerHeaders?: Headers, retryAfter?: number): Response {
  const headers = new Headers({ "cache-control": "no-store", "content-type": "application/json" });
  for (const cookie of providerHeaders?.getSetCookie?.() ?? []) headers.append("set-cookie", cookie);
  if (retryAfter !== undefined) headers.set("retry-after", String(retryAfter));
  return new Response(JSON.stringify(body), { status, headers });
}
