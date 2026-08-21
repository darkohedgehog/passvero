import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { betterAuth } from "better-auth";
import {
  CONTROLLED_ACTIVATION_FAILURE_POINTS,
  DIRECT_SERVER_API_ALLOWLIST,
  DISABLED_NATIVE_PATHS,
  H7_ROUTE_EXPOSURE_RUNTIME_VERDICT,
  RECOVERY_SERVER_ONLY_ENDPOINTS,
  controlledActivationPlugin,
  createRecoveryRouteBoundaryPlugin,
  type RecoveryProofBoundary,
} from "../src/auth.js";
import * as authModule from "../src/auth.js";

type HttpMethod = "GET" | "POST";
type UnknownRecord = Record<PropertyKey, unknown>;

interface EndpointRegistryEntry {
  readonly name: string;
  readonly path: string | null;
  readonly methods: readonly HttpMethod[];
  readonly serverOnly: boolean;
}

interface BaseForm {
  readonly id: "BASE_EXACT" | "BASE_TRAILING_SLASH";
  readonly baseURL: string;
  readonly basePath: string;
}

interface HttpVariant {
  readonly id:
    | "CANONICAL"
    | "ENDPOINT_TRAILING_SLASH"
    | "ENCODED_TRAILING_SLASH"
    | "DUPLICATE_SLASH"
    | "QUERY_STRING"
    | "WRONG_BASE_PATH"
    | "WRONG_ENDPOINT_PATH";
  readonly pathname: string;
  readonly expectedNormalizedPath: string;
}

const PINNED_ENDPOINT_REGISTRY = [
  { name: "signInSocial", path: "/sign-in/social", methods: ["POST"], serverOnly: false },
  { name: "callbackOAuth", path: "/callback/:id", methods: ["GET", "POST"], serverOnly: false },
  { name: "getSession", path: "/get-session", methods: ["GET", "POST"], serverOnly: false },
  { name: "signOut", path: "/sign-out", methods: ["POST"], serverOnly: false },
  { name: "signUpEmail", path: "/sign-up/email", methods: ["POST"], serverOnly: false },
  { name: "signInEmail", path: "/sign-in/email", methods: ["POST"], serverOnly: false },
  { name: "resetPassword", path: "/reset-password", methods: ["POST"], serverOnly: false },
  { name: "verifyPassword", path: "/verify-password", methods: ["POST"], serverOnly: false },
  { name: "verifyEmail", path: "/verify-email", methods: ["GET"], serverOnly: false },
  { name: "sendVerificationEmail", path: "/send-verification-email", methods: ["POST"], serverOnly: false },
  { name: "changeEmail", path: "/change-email", methods: ["POST"], serverOnly: false },
  { name: "changePassword", path: "/change-password", methods: ["POST"], serverOnly: false },
  { name: "setPassword", path: null, methods: ["POST"], serverOnly: true },
  { name: "updateSession", path: "/update-session", methods: ["POST"], serverOnly: false },
  { name: "updateUser", path: "/update-user", methods: ["POST"], serverOnly: false },
  { name: "deleteUser", path: "/delete-user", methods: ["POST"], serverOnly: false },
  { name: "requestPasswordReset", path: "/request-password-reset", methods: ["POST"], serverOnly: false },
  { name: "requestPasswordResetCallback", path: "/reset-password/:token", methods: ["GET"], serverOnly: false },
  { name: "listSessions", path: "/list-sessions", methods: ["GET"], serverOnly: false },
  { name: "revokeSession", path: "/revoke-session", methods: ["POST"], serverOnly: false },
  { name: "revokeSessions", path: "/revoke-sessions", methods: ["POST"], serverOnly: false },
  { name: "revokeOtherSessions", path: "/revoke-other-sessions", methods: ["POST"], serverOnly: false },
  { name: "linkSocialAccount", path: "/link-social", methods: ["POST"], serverOnly: false },
  { name: "listUserAccounts", path: "/list-accounts", methods: ["GET"], serverOnly: false },
  { name: "deleteUserCallback", path: "/delete-user/callback", methods: ["GET"], serverOnly: false },
  { name: "unlinkAccount", path: "/unlink-account", methods: ["POST"], serverOnly: false },
  { name: "refreshToken", path: "/refresh-token", methods: ["POST"], serverOnly: false },
  { name: "getAccessToken", path: "/get-access-token", methods: ["POST"], serverOnly: false },
  { name: "accountInfo", path: "/account-info", methods: ["GET"], serverOnly: false },
  { name: "activatePreprovisionedCredential", path: null, methods: ["POST"], serverOnly: true },
  { name: "issueCredentialTokenProof", path: null, methods: ["POST"], serverOnly: true },
  { name: "verifyEmailCredentialProof", path: null, methods: ["POST"], serverOnly: true },
  { name: "resetPasswordCredentialProof", path: null, methods: ["POST"], serverOnly: true },
  { name: "changePasswordCredentialProof", path: null, methods: ["POST"], serverOnly: true },
  { name: "afterCommitCredentialProbe", path: null, methods: ["POST"], serverOnly: true },
  { name: "ok", path: "/ok", methods: ["GET"], serverOnly: false },
  { name: "error", path: "/error", methods: ["GET"], serverOnly: false },
] as const satisfies readonly EndpointRegistryEntry[];

const PINNED_PLUGIN_ENDPOINT_NAMES = [
  "activatePreprovisionedCredential",
  ...RECOVERY_SERVER_ONLY_ENDPOINTS,
] as const;

const PINNED_BUILT_IN_ENDPOINT_NAMES = PINNED_ENDPOINT_REGISTRY
  .map(({ name }) => name)
  .filter((name) => !PINNED_PLUGIN_ENDPOINT_NAMES.some((pluginName) => pluginName === name));

const BASE_FORMS = [
  {
    id: "BASE_EXACT",
    baseURL: "https://auth-proof.invalid/internal-auth",
    basePath: "/internal-auth",
  },
  {
    id: "BASE_TRAILING_SLASH",
    baseURL: "https://auth-proof.invalid/internal-auth/",
    basePath: "/internal-auth/",
  },
] as const satisfies readonly BaseForm[];

const EXPECTED_DIRECT_ALLOWLIST = [
  "signInEmail",
  "activatePreprovisionedCredential",
  "issueCredentialTokenProof",
  "verifyEmailCredentialProof",
  "resetPasswordCredentialProof",
  "changePasswordCredentialProof",
  "afterCommitCredentialProbe",
] as const;

const EXPECTED_ENCODED_DYNAMIC_PATHS = [
  "/callback/:id%2F",
  "/reset-password/:token%2F",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function readMethods(value: unknown): readonly HttpMethod[] {
  const candidates = Array.isArray(value) ? value : [value];
  assert.ok(candidates.length > 0);
  const methods: HttpMethod[] = [];
  for (const method of candidates) {
    if (method !== "GET" && method !== "POST") throw new Error("STOP_ROUTE_METHOD_INVALID");
    methods.push(method);
  }
  return methods;
}

function runtimeEndpointRegistry(api: object): readonly EndpointRegistryEntry[] {
  return Object.entries(api).map(([name, endpoint]) => {
    assert.equal(isRecord(endpoint), true, `endpoint ${name} must be reflectable`);
    if (!isRecord(endpoint)) throw new Error("STOP_ROUTE_REGISTRY_INVALID");
    const options = Reflect.get(endpoint, "options");
    assert.equal(isRecord(options), true, `endpoint ${name} options missing`);
    if (!isRecord(options)) throw new Error("STOP_ROUTE_REGISTRY_INVALID");
    const pathValue = Reflect.get(endpoint, "path");
    assert.equal(pathValue === undefined || typeof pathValue === "string", true);
    const metadata = Reflect.get(options, "metadata");
    return {
      name,
      path: typeof pathValue === "string" ? pathValue : null,
      methods: readMethods(Reflect.get(options, "method")),
      serverOnly: isRecord(metadata) && Reflect.get(metadata, "SERVER_ONLY") === true,
    };
  });
}

function unavailable(): never {
  throw new Error("STOP_ROUTE_STATIC_HANDLER_INVOKED");
}

function staticRecoveryBoundary(): RecoveryProofBoundary {
  return {
    persistence: {
      invalidateActive: async () => unavailable(),
      create: async () => unavailable(),
      findByDigest: async () => unavailable(),
      invalidateById: async () => unavailable(),
      consumeActive: async () => unavailable(),
    },
    abuse: { advance: async () => unavailable() },
    capabilityKey: new Uint8Array(32),
    targetEmailKey: new Uint8Array(32),
    trustedNow: () => unavailable(),
  };
}

function productionDisabledPaths(): readonly string[] {
  const value = Reflect.get(authModule, "PRODUCTION_DISABLED_NATIVE_PATHS");
  assert.equal(Array.isArray(value), true, "production disabled-path registry missing");
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error("STOP_ROUTE_DISABLED_PATH_REGISTRY_INVALID");
  }
  return value;
}

function createStaticRouteAuth(base: BaseForm) {
  return betterAuth({
    appName: "Passvero route boundary proof",
    baseURL: base.baseURL,
    basePath: base.basePath,
    secret: randomBytes(32).toString("base64url"),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    disabledPaths: [...productionDisabledPaths()],
    plugins: [
      controlledActivationPlugin(),
      createRecoveryRouteBoundaryPlugin(staticRecoveryBoundary()),
    ],
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

function normalizeLikePinnedRouter(requestUrl: string, basePath: string): string {
  let pathname: string;
  try {
    pathname = new URL(requestUrl).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
  const normalizedBasePath = basePath.replace(/\/+$/, "");
  if (normalizedBasePath === "") return pathname;
  if (pathname === normalizedBasePath) return "/";
  if (pathname.startsWith(normalizedBasePath + "/")) {
    return pathname.slice(normalizedBasePath.length).replace(/\/+$/, "") || "/";
  }
  return pathname;
}

function canonicalPath(base: BaseForm, endpointPath: string): string {
  return `${base.basePath.replace(/\/+$/, "")}${endpointPath}`;
}

function httpVariants(base: BaseForm, endpointPath: string): readonly HttpVariant[] {
  const canonical = canonicalPath(base, endpointPath);
  return [
    { id: "CANONICAL", pathname: canonical, expectedNormalizedPath: endpointPath },
    { id: "ENDPOINT_TRAILING_SLASH", pathname: `${canonical}/`, expectedNormalizedPath: endpointPath },
    { id: "ENCODED_TRAILING_SLASH", pathname: `${canonical}%2F`, expectedNormalizedPath: `${endpointPath}%2F` },
    {
      id: "DUPLICATE_SLASH",
      pathname: `${base.basePath.replace(/\/+$/, "")}/${endpointPath}`,
      expectedNormalizedPath: `/${endpointPath}`,
    },
    { id: "QUERY_STRING", pathname: `${canonical}?route-proof=1`, expectedNormalizedPath: endpointPath },
    {
      id: "WRONG_BASE_PATH",
      pathname: `/wrong-auth${endpointPath}`,
      expectedNormalizedPath: `/wrong-auth${endpointPath}`,
    },
    {
      id: "WRONG_ENDPOINT_PATH",
      pathname: `${canonical}/wrong`,
      expectedNormalizedPath: `${endpointPath}/wrong`,
    },
  ];
}

function sourceEndpointNames(source: string): readonly string[] {
  const startMarker = "api: toAuthEndpoints({";
  const start = source.indexOf(startMarker);
  const end = source.indexOf("}, ctx)", start + startMarker.length);
  assert.ok(start >= 0 && end > start, "pinned endpoint source registry missing");
  return source
    .slice(start + startMarker.length, end)
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.length > 0 && line !== "...pluginEndpoints")
    .map((line) => line.includes(":") ? line.slice(0, line.indexOf(":")) : line);
}

function serverOnlySpellings(name: string): readonly string[] {
  const kebab = name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
  const snake = name.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
  return [`/${kebab}`, `/${name}`, `/${snake}`];
}

async function assertHttp404(input: {
  readonly auth: ReturnType<typeof createStaticRouteAuth>;
  readonly url: string;
  readonly method: HttpMethod;
  readonly matrixId: string;
}): Promise<void> {
  const response = await input.auth.handler(new Request(input.url, { method: input.method }));
  if (response.status >= 200 && response.status < 400) {
    assert.fail(`STOP_ROUTE_BYPASS:${input.matrixId}:${response.status}`);
  }
  assert.equal(response.status, 404, input.matrixId);
}

test("H7 freezes the exact HTTP and direct-call policy while runtime remains unexecuted", () => {
  assert.equal(H7_ROUTE_EXPOSURE_RUNTIME_VERDICT, "NOT_EXECUTED");
  assert.deepEqual(Reflect.get(authModule, "NATIVE_AUTH_ROUTE_ALLOWLIST"), []);
  assert.equal(Object.hasOwn(authModule, "handler"), false);
  assert.deepEqual(DIRECT_SERVER_API_ALLOWLIST, EXPECTED_DIRECT_ALLOWLIST);
  assert.deepEqual(CONTROLLED_ACTIVATION_FAILURE_POINTS, [
    "NONE", "AFTER_PROVIDER_CREDENTIAL_CREATION", "AFTER_AUTH_IDENTITY_CREATION",
  ]);
  assert.deepEqual(productionDisabledPaths(), [
    ...DISABLED_NATIVE_PATHS,
    ...EXPECTED_ENCODED_DYNAMIC_PATHS,
  ]);
});

test("runtime auth.api exactly matches the pinned source endpoint registry", async () => {
  const auth = createStaticRouteAuth(BASE_FORMS[0]);
  const runtimeRegistry = runtimeEndpointRegistry(auth.api);
  assert.deepEqual(runtimeRegistry, PINNED_ENDPOINT_REGISTRY);
  assert.equal(new Set(runtimeRegistry.map(({ name }) => name)).size, runtimeRegistry.length);

  const require = createRequire(import.meta.url);
  const entry = require.resolve("better-auth");
  const apiSource = await readFile(path.join(path.dirname(entry), "api/index.mjs"), "utf8");
  assert.deepEqual(sourceEndpointNames(apiSource), PINNED_BUILT_IN_ENDPOINT_NAMES);

  const urlSourcePath = require.resolve("@better-auth/core/utils/url");
  const urlSource = await readFile(urlSourcePath, "utf8");
  assert.equal(
    createHash("sha256").update(urlSource).digest("hex"),
    "2267b3ac785e7e513790b62347679e011dfea10e173c52dd32d0d1d694c664fe",
  );
});

test("every native HTTP method is denied for both base forms and every frozen spelling", async () => {
  const nativeRoutes = PINNED_ENDPOINT_REGISTRY.filter(
    (entry): entry is typeof entry & { readonly path: string } => entry.path !== null,
  );
  assert.deepEqual(
    [...nativeRoutes.map(({ path: endpointPath }) => endpointPath)].sort(),
    [...DISABLED_NATIVE_PATHS].sort(),
  );

  for (const base of BASE_FORMS) {
    const auth = createStaticRouteAuth(base);
    for (const endpoint of nativeRoutes) {
      for (const variant of httpVariants(base, endpoint.path)) {
        const url = `https://auth-proof.invalid${variant.pathname}`;
        assert.equal(
          normalizeLikePinnedRouter(url, base.basePath),
          variant.expectedNormalizedPath,
          `${base.id}:${endpoint.name}:${variant.id}:normalization`,
        );
        for (const method of endpoint.methods) {
          await assertHttp404({
            auth,
            url,
            method,
            matrixId: `${base.id}:${endpoint.name}:${method}:${variant.id}`,
          });
        }
      }
    }
  }
});

test("all pathless activation, recovery, and native server-only spellings are handler-unreachable", async () => {
  const pathless = PINNED_ENDPOINT_REGISTRY.filter(({ path: endpointPath }) => endpointPath === null);
  assert.deepEqual(pathless.map(({ name }) => name), [
    "setPassword", "activatePreprovisionedCredential", ...RECOVERY_SERVER_ONLY_ENDPOINTS,
  ]);
  assert.equal(pathless.every(({ serverOnly }) => serverOnly), true);

  for (const base of BASE_FORMS) {
    const auth = createStaticRouteAuth(base);
    for (const endpoint of pathless) {
      for (const guessedPath of serverOnlySpellings(endpoint.name)) {
        for (const variant of httpVariants(base, guessedPath)) {
          await assertHttp404({
            auth,
            url: `https://auth-proof.invalid${variant.pathname}`,
            method: endpoint.methods[0],
            matrixId: `${base.id}:${endpoint.name}:${guessedPath}:${variant.id}`,
          });
        }
      }
    }
  }
});

test("direct API remains distinct, exact-allowlisted, and direct signup is rejected", async () => {
  const auth = createStaticRouteAuth(BASE_FORMS[0]);
  const registry = runtimeEndpointRegistry(auth.api);
  const runtimeNames = new Set(registry.map(({ name }) => name));
  assert.equal(DIRECT_SERVER_API_ALLOWLIST.every((name) => runtimeNames.has(name)), true);
  assert.equal(new Set<string>(DIRECT_SERVER_API_ALLOWLIST).has("signUpEmail"), false);
  assert.deepEqual(
    registry
      .filter(({ name }) => DIRECT_SERVER_API_ALLOWLIST.some((allowed) => allowed === name))
      .map(({ name }) => name),
    EXPECTED_DIRECT_ALLOWLIST,
  );

  await assert.rejects(
    () => auth.api.signUpEmail({
      body: {
        name: "route-boundary-fixture",
        email: "route-boundary@invalid.example",
        password: "route-boundary-synthetic-value",
      },
    }),
    (error: unknown) => {
      if (!isRecord(error)) return false;
      const body = Reflect.get(error, "body");
      return Reflect.get(error, "status") === "BAD_REQUEST"
        && isRecord(body)
        && Reflect.get(body, "code") === "EMAIL_PASSWORD_SIGN_UP_DISABLED";
    },
    "STOP_ROUTE_BYPASS: direct signup succeeded or returned the wrong rejection",
  );
});
