import assert from "node:assert/strict";
import test from "node:test";

import {
  activateAccount,
  captureActivationCapability,
  captureEmailLinkToken,
  consumeEmailVerification,
  readActivationCapabilityFragment,
  readEmailLinkTokenFragment,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  signIn,
} from "../../src/application/auth/auth-ui-client";

type CapturedRequest = Readonly<{ url: string; init: RequestInit | undefined }>;

function fakeFetch(response: Response) {
  const requests: CapturedRequest[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: input.toString(), init });
    return response;
  };
  return { fetcher, requests };
}

test("sign-in maps only the approved success shape and sends credentials same-origin", async () => {
  const fixture = fakeFetch(Response.json({ status: "AUTHENTICATED", provider: "hidden" }));

  const result = await signIn(fixture.fetcher, {
    email: "person@example.com",
    password: "correct horse battery staple",
  });

  assert.equal(result, "SUCCESS");
  assert.equal(fixture.requests[0]?.url, "/api/auth/sign-in");
  assert.equal(fixture.requests[0]?.init?.method, "POST");
  assert.equal(fixture.requests[0]?.init?.credentials, "same-origin");
  assert.equal(fixture.requests[0]?.init?.cache, "no-store");
  assert.equal(fixture.requests[0]?.init?.referrerPolicy, "no-referrer");
  assert.deepEqual(JSON.parse(String(fixture.requests[0]?.init?.body)), {
    email: "person@example.com",
    password: "correct horse battery staple",
  });
});

test("risk response becomes one provider-neutral Turnstile state and resubmission carries one token", async () => {
  const challenged = fakeFetch(Response.json(
    { status: "ADDITIONAL_VERIFICATION_REQUIRED" },
    { status: 403 },
  ));
  assert.equal(await signIn(challenged.fetcher, {
    email: "person@example.com",
    password: "secret",
  }), "TURNSTILE_REQUIRED");

  const allowed = fakeFetch(Response.json({ status: "ACTIVATION_ACCEPTED" }, { status: 202 }));
  assert.equal(await activateAccount(allowed.fetcher, {
    capability: "a".repeat(43),
    password: "correct horse battery staple",
    turnstileToken: "one-use-token",
  }), "SUCCESS");
  assert.deepEqual(JSON.parse(String(allowed.requests[0]?.init?.body)), {
    capability: "a".repeat(43),
    password: "correct horse battery staple",
    turnstileToken: "one-use-token",
  });
});

test("verification consume keeps the provider token only in the explicit consume request URL and Turnstile token in its bounded header", async () => {
  const fixture = fakeFetch(Response.json({ status: "VERIFIED" }));

  const result = await consumeEmailVerification(
    fixture.fetcher,
    "provider-token",
    "one-use-turnstile-token",
  );

  assert.equal(result, "SUCCESS");
  assert.equal(
    fixture.requests[0]?.url,
    "/api/auth/verification/consume?token=provider-token",
  );
  assert.deepEqual(fixture.requests[0]?.init?.headers, {
    "x-passvero-turnstile-token": "one-use-turnstile-token",
  });
  assert.equal(fixture.requests[0]?.init?.referrerPolicy, "no-referrer");
  assert.equal(fixture.requests[0]?.url.includes("one-use-turnstile-token"), false);
});

test("verification consume distinguishes a safe invalid-link result from an operational failure", async () => {
  const invalid = fakeFetch(Response.json(
    { status: "VERIFICATION_DENIED" },
    { status: 400 },
  ));
  const operational = fakeFetch(Response.json(
    { status: "OPERATIONAL_FAILURE" },
    { status: 503 },
  ));

  assert.equal(
    await consumeEmailVerification(invalid.fetcher, "expired-token"),
    "INVALID_OR_EXPIRED",
  );
  assert.equal(
    await consumeEmailVerification(operational.fetcher, "opaque-token"),
    "FAILURE",
  );
});

test("generic request success remains equivalent and malformed responses fail closed", async () => {
  const accepted = fakeFetch(Response.json({ status: "ACCEPTED" }, { status: 202 }));
  const malformed = fakeFetch(new Response("provider detail", { status: 500 }));

  assert.equal(await requestPasswordReset(accepted.fetcher, {
    email: "known@example.com",
  }), "SUCCESS");
  assert.equal(await requestPasswordReset(malformed.fetcher, {
    email: "unknown@example.com",
  }), "FAILURE");
});

test("verification resend and password reset completion use only their explicit endpoints", async () => {
  const verification = fakeFetch(Response.json({ status: "ACCEPTED" }, { status: 202 }));
  const reset = fakeFetch(Response.json({ status: "PASSWORD_RESET" }));

  assert.equal(await requestEmailVerification(verification.fetcher, {
    email: "person@example.com",
  }), "SUCCESS");
  assert.equal(verification.requests[0]?.url, "/api/auth/verification/request");

  assert.equal(await resetPassword(reset.fetcher, {
    token: "opaque-reset-token",
    newPassword: "correct horse battery staple",
  }), "SUCCESS");
  assert.equal(reset.requests[0]?.url, "/api/auth/password-reset/consume");
});

test("email-link token readers accept only one bounded fragment value", () => {
  assert.equal(readActivationCapabilityFragment(`#capability=${"a".repeat(43)}`), "a".repeat(43));
  assert.equal(readActivationCapabilityFragment(`?capability=${"a".repeat(43)}`), null);
  assert.equal(readActivationCapabilityFragment("#capability=short"), null);
  assert.equal(readActivationCapabilityFragment(`#capability=${"a".repeat(43)}&extra=true`), null);
  assert.equal(readActivationCapabilityFragment(`#capability=${"a".repeat(43)}&capability=${"b".repeat(43)}`), null);

  assert.equal(readEmailLinkTokenFragment("#token=opaque-token"), "opaque-token");
  assert.equal(readEmailLinkTokenFragment("?token=opaque-token"), null);
  assert.equal(readEmailLinkTokenFragment("#token=one&token=two"), null);
  assert.equal(readEmailLinkTokenFragment("#token=opaque&provider=detail"), null);
  assert.equal(readEmailLinkTokenFragment(`#token=${"x".repeat(2049)}`), null);
});

test("capabilities are captured once and the URL is scrubbed synchronously", () => {
  const paths: string[] = [];
  const history = {
    replaceState(_data: unknown, _unused: string, path: string | URL | null) {
      paths.push(String(path));
    },
  };

  assert.equal(captureActivationCapability(
    { hash: `#capability=${"a".repeat(43)}`, pathname: "/hr/activate-account" },
    history,
  ), "a".repeat(43));
  assert.equal(captureEmailLinkToken(
    { hash: "#token=opaque-token", pathname: "/hr/verify-email" },
    history,
  ), "opaque-token");
  assert.deepEqual(paths, ["/hr/activate-account", "/hr/verify-email"]);
});
