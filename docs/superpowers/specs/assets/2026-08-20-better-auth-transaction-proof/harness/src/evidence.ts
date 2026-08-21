export type HypothesisId =
  | "H1_NATIVE_TRANSACTION"
  | "H2_DIRECT_API_OUTER_TRANSACTION"
  | "H3_HANDLER_CONTEXT_REPLACEMENT"
  | "H4_CONTROLLED_ACTIVATION"
  | "H5_SESSION_COOKIE_AFTER_COMMIT"
  | "H6_RECOVERY_AND_REVOCATION"
  | "H7_ROUTE_EXPOSURE";

export type HypothesisStatus = "PASS" | "FAIL";

export const REQUIRED_HYPOTHESIS_IDS = [
  "H1_NATIVE_TRANSACTION",
  "H2_DIRECT_API_OUTER_TRANSACTION",
  "H3_HANDLER_CONTEXT_REPLACEMENT",
  "H4_CONTROLLED_ACTIVATION",
  "H5_SESSION_COOKIE_AFTER_COMMIT",
  "H6_RECOVERY_AND_REVOCATION",
  "H7_ROUTE_EXPOSURE",
] as const satisfies readonly HypothesisId[];

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
  readonly deltas: RowCounts;
  readonly cookie: DeferredCookie;
  readonly assertions: readonly string[];
  readonly failureCode: string | null;
}

export const HYPOTHESIS_ASSERTION_CODES = {
  H1_NATIVE_TRANSACTION: ["H1_NATIVE_AND_NESTED_ASSERTIONS_COMPLETE"],
  H2_DIRECT_API_OUTER_TRANSACTION: ["H2_DIRECT_BOUNDARY_ASSERTIONS_COMPLETE"],
  H3_HANDLER_CONTEXT_REPLACEMENT: ["H3_HANDLER_REJECTION_ASSERTIONS_COMPLETE"],
  H4_CONTROLLED_ACTIVATION: ["H4_CONTROLLED_ACTIVATION_ASSERTIONS_COMPLETE"],
  H5_SESSION_COOKIE_AFTER_COMMIT: ["H5_SESSION_AND_COOKIE_ASSERTIONS_COMPLETE"],
  H6_RECOVERY_AND_REVOCATION: ["H6_RECOVERY_AND_REVOCATION_ASSERTIONS_COMPLETE"],
  H7_ROUTE_EXPOSURE: ["H7_ROUTE_EXPOSURE_ASSERTIONS_COMPLETE"],
} as const satisfies Readonly<Record<HypothesisId, readonly string[]>>;

export interface HypothesisAssertionResult extends HypothesisEvidence {
  readonly status: "PASS";
  readonly failureCode: null;
}

export interface HypothesisProcessFailure {
  readonly id: HypothesisId;
  readonly status: "FAIL";
  readonly processExitCode: number;
  readonly failureCode: "STOP_HYPOTHESIS_PROCESS_FAILED";
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

const EMPTY_ROW_COUNTS: RowCounts = {
  providerUser: 0,
  providerAccount: 0,
  providerSession: 0,
  providerVerification: 0,
  canonicalUser: 0,
  authIdentity: 0,
  activation: 0,
  credentialToken: 0,
  abuseBucket: 0,
};

function isHypothesisId(value: unknown): value is HypothesisId {
  return typeof value === "string"
    && (REQUIRED_HYPOTHESIS_IDS as readonly string[]).includes(value);
}

const ROW_COUNT_KEYS = [
  "providerUser", "providerAccount", "providerSession", "providerVerification",
  "canonicalUser", "authIdentity", "activation", "credentialToken", "abuseBucket",
] as const satisfies readonly (keyof RowCounts)[];

const ASSERTION_RESULT_KEYS = [
  "id", "status", "transactionIds", "before", "after", "deltas", "cookie",
  "assertions", "failureCode",
] as const;

function hasExactKeys(record: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function parseRowCounts(value: unknown, allowNegative: boolean): RowCounts | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (!hasExactKeys(record, ROW_COUNT_KEYS)) return null;
  const parsed = Object.fromEntries(ROW_COUNT_KEYS.map((key) => [key, Number(record[key])])) as unknown;
  if (parsed === null || typeof parsed !== "object") return null;
  const counts = parsed as RowCounts;
  if (!ROW_COUNT_KEYS.every((key) => Number.isSafeInteger(counts[key])
    && (allowNegative || counts[key] >= 0))) return null;
  return counts;
}

export function deltaRowCounts(before: RowCounts, after: RowCounts): RowCounts {
  return Object.fromEntries(ROW_COUNT_KEYS.map((key) => [key, after[key] - before[key]])) as unknown as RowCounts;
}

function parseCookie(value: unknown): DeferredCookie | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (!hasExactKeys(record, [
    "present", "nameHash", "secure", "httpOnly", "sameSite", "hostOnly", "maxAgeSeconds",
  ])) return null;
  if (typeof record.present !== "boolean" || typeof record.secure !== "boolean"
    || typeof record.httpOnly !== "boolean" || typeof record.hostOnly !== "boolean") return null;
  if (record.nameHash !== null && (typeof record.nameHash !== "string" || !/^[a-f0-9]{64}$/.test(record.nameHash))) return null;
  if (record.sameSite !== null && record.sameSite !== "lax") return null;
  if (record.maxAgeSeconds !== null
    && (!Number.isSafeInteger(record.maxAgeSeconds) || Number(record.maxAgeSeconds) < 0)) return null;
  if (!record.present && (record.nameHash !== null || record.secure || record.httpOnly
    || record.sameSite !== null || !record.hostOnly || record.maxAgeSeconds !== null)) return null;
  return {
    present: record.present,
    nameHash: record.nameHash as string | null,
    secure: record.secure,
    httpOnly: record.httpOnly,
    sameSite: record.sameSite as "lax" | null,
    hostOnly: record.hostOnly,
    maxAgeSeconds: record.maxAgeSeconds as number | null,
  };
}

export function parseHypothesisAssertionResult(value: unknown): HypothesisAssertionResult | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (!hasExactKeys(record, ASSERTION_RESULT_KEYS)) return null;
  if (!isHypothesisId(record.id)) return null;
  if (record.status !== "PASS" || record.failureCode !== null) return null;
  if (!Array.isArray(record.transactionIds)
    || !record.transactionIds.every((entry) => typeof entry === "string" && /^[a-f0-9]{64}$/.test(entry))) return null;
  const before = parseRowCounts(record.before, false);
  const after = parseRowCounts(record.after, false);
  const deltas = parseRowCounts(record.deltas, true);
  const cookie = parseCookie(record.cookie);
  if (!before || !after || !deltas || !cookie) return null;
  const computed = deltaRowCounts(before, after);
  if (!ROW_COUNT_KEYS.every((key) => computed[key] === deltas[key])) return null;
  const allowedAssertions = HYPOTHESIS_ASSERTION_CODES[record.id] as readonly string[];
  const assertions = record.assertions;
  if (!Array.isArray(assertions)
    || assertions.length !== allowedAssertions.length
    || new Set(assertions).size !== assertions.length
    || !allowedAssertions.every((entry) => assertions.includes(entry))) return null;
  return {
    id: record.id,
    status: "PASS",
    transactionIds: [...record.transactionIds] as string[],
    before,
    after,
    deltas,
    cookie,
    assertions: [...assertions] as string[],
    failureCode: null,
  };
}

function parseProcessFailure(value: unknown): HypothesisProcessFailure | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (!hasExactKeys(record, ["id", "status", "processExitCode", "failureCode"])) return null;
  if (!isHypothesisId(record.id) || record.status !== "FAIL"
    || record.failureCode !== "STOP_HYPOTHESIS_PROCESS_FAILED") return null;
  if (!Number.isSafeInteger(record.processExitCode)
    || Number(record.processExitCode) <= 0 || Number(record.processExitCode) > 255) return null;
  return {
    id: record.id,
    status: "FAIL",
    processExitCode: Number(record.processExitCode),
    failureCode: "STOP_HYPOTHESIS_PROCESS_FAILED",
  };
}

function processEvidence(
  id: HypothesisId,
  status: HypothesisStatus,
  failureCode: string | null,
): HypothesisEvidence {
  return {
    id,
    status,
    transactionIds: [],
    before: EMPTY_ROW_COUNTS,
    after: EMPTY_ROW_COUNTS,
    deltas: EMPTY_ROW_COUNTS,
    cookie: EMPTY_DEFERRED_COOKIE,
    assertions: status === "PASS" ? HYPOTHESIS_ASSERTION_CODES[id] : [],
    failureCode,
  };
}

export function aggregateHypothesisProcessResults(
  candidates: readonly unknown[],
): readonly HypothesisEvidence[] {
  const parsed = candidates.map((candidate) => parseHypothesisAssertionResult(candidate) ?? parseProcessFailure(candidate));
  const containsInvalid = parsed.some((candidate) => candidate === null);
  const valid = parsed.filter((candidate): candidate is HypothesisAssertionResult | HypothesisProcessFailure => candidate !== null);
  return REQUIRED_HYPOTHESIS_IDS.map((id, index) => {
    const matches = valid.filter((candidate) => candidate.id === id);
    if (containsInvalid && index === 0) {
      return processEvidence(id, "FAIL", "STOP_HYPOTHESIS_RESULT_INVALID");
    }
    if (matches.length === 0) {
      return processEvidence(id, "FAIL", "STOP_HYPOTHESIS_RESULT_MISSING");
    }
    if (matches.length !== 1) {
      return processEvidence(id, "FAIL", "STOP_HYPOTHESIS_RESULT_DUPLICATE");
    }
    const result = matches[0];
    if (result.status === "FAIL") {
      return processEvidence(id, "FAIL", "STOP_HYPOTHESIS_PROCESS_FAILED");
    }
    return result;
  });
}

export function mandatoryHypothesesPassed(
  hypotheses: readonly HypothesisEvidence[],
): boolean {
  return hypotheses.length === REQUIRED_HYPOTHESIS_IDS.length
    && new Set(hypotheses.map(({ id }) => id)).size === REQUIRED_HYPOTHESIS_IDS.length
    && REQUIRED_HYPOTHESIS_IDS.every((id) => hypotheses.some(
      (hypothesis) => hypothesis.id === id && hypothesis.status === "PASS",
    ));
}

const FORBIDDEN_KEY = /token|password|secret|email|ipAddress|url|cookieValue/i;
const FORBIDDEN_VALUE = [
  /postgres(?:ql)?:\/\//i,
  /https?:\/\//i,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:^|\s)\/(?:Users|private|tmp|var|opt|home)(?:\/|\s|$)/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\b\d{8,}\b/,
  /\b(?=[A-Za-z0-9_-]{32,63}\b)(?=.*[G-Zg-z_-])[A-Za-z0-9_-]+\b/,
  /set-cookie\s*:/i,
  /(?:^|\s)(?:__Host-|__Secure-)?[!#$%&'*+.^_`|~0-9A-Za-z-]+=[^;,\s]+;\s*(?:Domain|Expires|HttpOnly|Max-Age|Partitioned|Path|SameSite|Secure)\b/i,
];

function validateEvidence(value: unknown, key = "root"): void {
  if (FORBIDDEN_KEY.test(key)) throw new Error(`STOP_EVIDENCE_REDACTION: forbidden key ${key}`);
  if (typeof value === "string") {
    if (/^(?:H[1-7]_[A-Z0-9_]+|STOP_(?:HYPOTHESIS_(?:RESULT_(?:INVALID|MISSING|DUPLICATE)|PROCESS_FAILED)|PRE_EVIDENCE_FAILURE))$/.test(value)) {
      return;
    }
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
      deltas: projectRowCounts(hypothesis.deltas),
    })),
  };
}

export function renderEvidenceJson(evidence: ProofEvidence): string {
  const projected = projectEvidence(evidence);
  validateEvidence(projected);
  return `${JSON.stringify(projected, null, 2)}\n`;
}

export function renderPendingEvidenceJson(evidence: Omit<ProofEvidence, "cleanup">): string {
  const projected = projectEvidence({ ...evidence, cleanup: {} }) as Readonly<Record<string, unknown>>;
  const { cleanup: _cleanup, ...pending } = projected;
  validateEvidence(pending);
  return `${JSON.stringify(pending, null, 2)}\n`;
}

export function renderEvidenceMarkdown(evidence: ProofEvidence): string {
  validateEvidence(projectEvidence(evidence));
  const rows = evidence.hypotheses.map((item) => `| ${item.id} | ${item.status} | ${item.failureCode ?? "none"} |`);
  const markdown = [
    "# Better Auth transaction proof evidence companion",
    "",
    "NON-AUTHORITATIVE: evidence.json is the sole authoritative proof result.",
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
