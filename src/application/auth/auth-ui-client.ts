import { AUTH_TURNSTILE_TOKEN_HEADER } from "./auth-turnstile-header";

export type AuthUiResult = "SUCCESS" | "TURNSTILE_REQUIRED" | "FAILURE";
export type VerificationUiResult = AuthUiResult | "INVALID_OR_EXPIRED";

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type TurnstileInput = Readonly<{ turnstileToken?: string }>;

export function signIn(
  fetcher: Fetcher,
  input: Readonly<{ email: string; password: string }> & TurnstileInput,
): Promise<AuthUiResult> {
  return postJson(fetcher, "/api/auth/sign-in", input, "AUTHENTICATED");
}

export function activateAccount(
  fetcher: Fetcher,
  input: Readonly<{ capability: string; password: string }> & TurnstileInput,
): Promise<AuthUiResult> {
  return postJson(fetcher, "/api/auth/activate", input, "ACTIVATION_ACCEPTED");
}

export function requestEmailVerification(
  fetcher: Fetcher,
  input: Readonly<{ email: string }> & TurnstileInput,
): Promise<AuthUiResult> {
  return postJson(
    fetcher,
    "/api/auth/verification/request",
    input,
    "ACCEPTED",
  );
}

export function requestPasswordReset(
  fetcher: Fetcher,
  input: Readonly<{ email: string }> & TurnstileInput,
): Promise<AuthUiResult> {
  return postJson(
    fetcher,
    "/api/auth/password-reset/request",
    input,
    "ACCEPTED",
  );
}

export function resetPassword(
  fetcher: Fetcher,
  input: Readonly<{ token: string; newPassword: string }> & TurnstileInput,
): Promise<AuthUiResult> {
  return postJson(
    fetcher,
    "/api/auth/password-reset/consume",
    input,
    "PASSWORD_RESET",
  );
}

export async function consumeEmailVerification(
  fetcher: Fetcher,
  token: string,
  turnstileToken?: string,
): Promise<VerificationUiResult> {
  const headers = turnstileToken === undefined
    ? undefined
    : { [AUTH_TURNSTILE_TOKEN_HEADER]: turnstileToken };
  try {
    const response = await fetcher(
      `/api/auth/verification/consume?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        ...(headers === undefined ? {} : { headers }),
      },
    );
    const result = await readResult(response, "VERIFIED");
    if (result === "FAILURE" && response.status === 400) {
      return "INVALID_OR_EXPIRED";
    }
    return result;
  } catch {
    return "FAILURE";
  }
}

export function readActivationCapabilityFragment(fragment: string): string | null {
  const value = readSingleFragmentValue(fragment, "capability", 43);
  return value !== null && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function readEmailLinkTokenFragment(fragment: string): string | null {
  return readSingleFragmentValue(fragment, "token", 2048);
}

type CapabilityLocation = Readonly<Pick<Location, "hash" | "pathname">>;
type CapabilityHistory = Pick<History, "replaceState">;

export function captureActivationCapability(
  location: CapabilityLocation,
  history: CapabilityHistory,
): string | null {
  return captureCapability(location, history, readActivationCapabilityFragment);
}

export function captureEmailLinkToken(
  location: CapabilityLocation,
  history: CapabilityHistory,
): string | null {
  return captureCapability(location, history, readEmailLinkTokenFragment);
}

async function postJson(
  fetcher: Fetcher,
  endpoint: string,
  body: Record<string, unknown>,
  successStatus: string,
): Promise<AuthUiResult> {
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withoutUndefined(body)),
    });
    return readResult(response, successStatus);
  } catch {
    return "FAILURE";
  }
}

async function readResult(
  response: Response,
  successStatus: string,
): Promise<AuthUiResult> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return "FAILURE";
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "FAILURE";
  }
  const status = (value as Record<string, unknown>).status;
  if (status === "ADDITIONAL_VERIFICATION_REQUIRED") {
    return "TURNSTILE_REQUIRED";
  }
  return response.ok && status === successStatus ? "SUCCESS" : "FAILURE";
}

function withoutUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined),
  );
}

function captureCapability(
  location: CapabilityLocation,
  history: CapabilityHistory,
  read: (fragment: string) => string | null,
): string | null {
  const capability = read(location.hash);
  history.replaceState(null, "", location.pathname);
  return capability;
}

function readSingleFragmentValue(
  fragment: string,
  key: string,
  maximumLength: number,
): string | null {
  if (!fragment.startsWith("#")) {
    return null;
  }
  const parameters = new URLSearchParams(fragment.slice(1));
  const values = parameters.getAll(key);
  if (
    values.length !== 1
    || values[0].length === 0
    || values[0].length > maximumLength
    || [...parameters.keys()].some((candidate) => candidate !== key)
  ) {
    return null;
  }
  return values[0];
}
