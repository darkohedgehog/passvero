export type HypothesisId =
  | "H1_NATIVE_TRANSACTION"
  | "H2_DIRECT_API_OUTER_TRANSACTION"
  | "H3_HANDLER_CONTEXT_REPLACEMENT"
  | "H4_CONTROLLED_ACTIVATION"
  | "H5_SESSION_COOKIE_AFTER_COMMIT"
  | "H6_RECOVERY_AND_REVOCATION"
  | "H7_ROUTE_EXPOSURE";

export type HypothesisStatus = "PASS" | "FAIL";

export interface RowCounts {
  readonly providerUser: number;
  readonly providerAccount: number;
  readonly providerSession: number;
  readonly providerVerification: number;
  readonly canonicalUser: number;
  readonly authIdentity: number;
  readonly activation: number;
  readonly credentialToken: number;
  readonly abuseBucket: number;
}

export interface DeferredCookie {
  readonly present: boolean;
  readonly nameHash: string | null;
  readonly secure: boolean;
  readonly httpOnly: boolean;
  readonly sameSite: "lax" | null;
  readonly hostOnly: boolean;
  readonly maxAgeSeconds: number | null;
}

export const EMPTY_DEFERRED_COOKIE = {
  present: false,
  nameHash: null,
  secure: false,
  httpOnly: false,
  sameSite: null,
  hostOnly: true,
  maxAgeSeconds: null,
} as const satisfies DeferredCookie;

export type H1ScenarioId =
  | "TRANSACTION_FALSE_SPLIT_NEGATIVE_CONTROL"
  | "TRANSACTION_TRUE_ROLLBACK"
  | "TRANSACTION_TRUE_NESTED_REUSE"
  | "TRANSACTION_FALSE_TX_BOUND_REUSE";

export interface H1ScenarioContract {
  readonly id: H1ScenarioId;
  readonly adapterTransaction: boolean;
  readonly explicitOuterTransaction: boolean;
  readonly nestedRunWithTransaction: boolean;
  readonly acceptedArchitecture: boolean;
  readonly expectedProviderUserDelta: number;
  readonly expectedProviderAccountDelta: number;
  readonly expectedPrismaTransactionCalls: number;
  readonly expectedSingleTransactionId: boolean;
}

export const H1_NATIVE_TRANSACTION_RUNTIME_VERDICT = "NOT_EXECUTED" as const;

export const H1_NATIVE_TRANSACTION_SCENARIOS = [
  {
    id: "TRANSACTION_FALSE_SPLIT_NEGATIVE_CONTROL",
    adapterTransaction: false,
    explicitOuterTransaction: false,
    nestedRunWithTransaction: false,
    acceptedArchitecture: false,
    expectedProviderUserDelta: 1,
    expectedProviderAccountDelta: 0,
    expectedPrismaTransactionCalls: 0,
    expectedSingleTransactionId: false,
  },
  {
    id: "TRANSACTION_TRUE_ROLLBACK",
    adapterTransaction: true,
    explicitOuterTransaction: false,
    nestedRunWithTransaction: false,
    acceptedArchitecture: true,
    expectedProviderUserDelta: 0,
    expectedProviderAccountDelta: 0,
    expectedPrismaTransactionCalls: 1,
    expectedSingleTransactionId: true,
  },
  {
    id: "TRANSACTION_TRUE_NESTED_REUSE",
    adapterTransaction: true,
    explicitOuterTransaction: false,
    nestedRunWithTransaction: true,
    acceptedArchitecture: true,
    expectedProviderUserDelta: 0,
    expectedProviderAccountDelta: 0,
    expectedPrismaTransactionCalls: 1,
    expectedSingleTransactionId: true,
  },
  {
    id: "TRANSACTION_FALSE_TX_BOUND_REUSE",
    adapterTransaction: false,
    explicitOuterTransaction: true,
    nestedRunWithTransaction: true,
    acceptedArchitecture: true,
    expectedProviderUserDelta: 0,
    expectedProviderAccountDelta: 0,
    expectedPrismaTransactionCalls: 1,
    expectedSingleTransactionId: true,
  },
] as const satisfies readonly H1ScenarioContract[];

export interface H1WriteObservation {
  readonly model:
    | "AuthProviderUser"
    | "AuthProviderAccount"
    | "AuthProviderSession"
    | "AuthProviderVerification";
  readonly action: "create" | "update" | "updateMany" | "delete" | "deleteMany" | "upsert";
  readonly phase: "BEFORE" | "AFTER";
  readonly transactionIdHash: string;
}

export interface H1ScenarioEvidence {
  readonly id: H1ScenarioId;
  readonly status: HypothesisStatus;
  readonly adapterTransaction: boolean;
  readonly explicitOuterTransaction: boolean;
  readonly nestedRunWithTransaction: boolean;
  readonly acceptedArchitecture: boolean;
  readonly expectedProviderUserDelta: number;
  readonly expectedProviderAccountDelta: number;
  readonly prismaTransactionCalls: number;
  readonly transactionIds: readonly string[];
  readonly writes: readonly H1WriteObservation[];
  readonly before: RowCounts;
  readonly after: RowCounts;
  readonly responseStatus: number;
  readonly responseHeaderCount: number;
  readonly setCookieHeaderCount: number;
  readonly cookie: DeferredCookie;
  readonly fixtureCleaned: boolean;
  readonly successfulProviderWriteOrigin: "BETTER_AUTH_API";
  readonly assertions: readonly string[];
  readonly failureCode: string | null;
}

export interface H1NativeTransactionEvidence {
  readonly id: "H1_NATIVE_TRANSACTION";
  readonly runtimeVerdict: typeof H1_NATIVE_TRANSACTION_RUNTIME_VERDICT | HypothesisStatus;
  readonly scenarios: readonly H1ScenarioEvidence[];
  readonly assertions: readonly string[];
  readonly failureCode: string | null;
}

export interface HypothesisEvidence {
  readonly id: HypothesisId;
  readonly status: HypothesisStatus;
  readonly transactionIds: readonly string[];
  readonly before: RowCounts;
  readonly after: RowCounts;
  readonly cookie: DeferredCookie;
  readonly assertions: readonly string[];
  readonly failureCode: string | null;
}

export interface ProofEvidence {
  readonly packageHashes: Readonly<Record<string, string>>;
  readonly clusterIdHash: string;
  readonly postgresVersionHash: string;
  readonly systemIdentifierHash: string;
  readonly hypotheses: readonly HypothesisEvidence[];
  readonly cleanup: Readonly<Record<string, boolean>>;
  readonly assertions: readonly string[];
}

const FORBIDDEN_KEY = /token|password|secret|email|ipAddress|url|cookieValue/i;
const FORBIDDEN_VALUE = [
  /postgres(?:ql)?:\/\//i,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /set-cookie\s*:/i,
  /(?:^|\s)(?:__Host-|__Secure-)?[!#$%&'*+.^_`|~0-9A-Za-z-]+=[^;,\s]+;\s*(?:Domain|Expires|HttpOnly|Max-Age|Partitioned|Path|SameSite|Secure)\b/i,
];

function validateEvidence(value: unknown, key = "root"): void {
  if (FORBIDDEN_KEY.test(key)) throw new Error(`STOP_EVIDENCE_REDACTION: forbidden key ${key}`);
  if (typeof value === "string") {
    for (const pattern of FORBIDDEN_VALUE) {
      if (pattern.test(value)) throw new Error(`STOP_EVIDENCE_REDACTION: forbidden value at ${key}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateEvidence(entry, `${key}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) validateEvidence(childValue, childKey);
  }
}

function projectRowCounts(counts: RowCounts): Omit<RowCounts, "credentialToken"> & {
  readonly credentialRecord: number;
} {
  const { credentialToken, ...safeCounts } = counts;
  return { ...safeCounts, credentialRecord: credentialToken };
}

function projectEvidence(evidence: ProofEvidence): unknown {
  return {
    ...evidence,
    hypotheses: evidence.hypotheses.map((hypothesis) => ({
      ...hypothesis,
      before: projectRowCounts(hypothesis.before),
      after: projectRowCounts(hypothesis.after),
    })),
  };
}

export function renderEvidenceJson(evidence: ProofEvidence): string {
  const projected = projectEvidence(evidence);
  validateEvidence(projected);
  return `${JSON.stringify(projected, null, 2)}\n`;
}

export function renderEvidenceMarkdown(evidence: ProofEvidence): string {
  validateEvidence(projectEvidence(evidence));
  const rows = evidence.hypotheses.map((item) => `| ${item.id} | ${item.status} | ${item.failureCode ?? "none"} |`);
  const markdown = [
    "# Better Auth transaction proof evidence",
    "",
    "| Hypothesis | Status | Failure code |",
    "| --- | --- | --- |",
    ...rows,
    "",
    `Cleanup checks: ${Object.values(evidence.cleanup).every(Boolean) ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
  validateEvidence(markdown);
  return markdown;
}
