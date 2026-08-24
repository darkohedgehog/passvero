export type PasswordPolicyRejectionReason =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "COMMON_PASSWORD"
  | "COMPROMISED_PASSWORD"
  | "CONTEXTUAL_PASSWORD"
  | "INVALID_INPUT";

export interface PasswordPolicyInput {
  readonly password: unknown;
  readonly normalizedEmail?: unknown;
  readonly displayName?: unknown;
}

export type PasswordPolicyResult =
  | { readonly accepted: true }
  | {
    readonly accepted: false;
    readonly reason: PasswordPolicyRejectionReason;
  };

export interface PasswordCompromiseChecker {
  getCompromisedSuffixes(digestPrefix: string): Promise<readonly string[]>;
}

export interface PasswordCompromiseDigest {
  readonly prefix: string;
  readonly suffix: string;
}

export interface PasswordCompromiseDigester {
  digest(preparedNfcPassword: string): Promise<PasswordCompromiseDigest>;
}

const MIN_PASSWORD_CODE_POINTS = 15;
const MAX_PASSWORD_CODE_POINTS = 128;
const commonPasswords = new Set([
  "correct horse battery staple",
  "letmeinletmein",
  "passwordpassword",
  "qwertyuiopasdfgh",
]);
const locallyCompromisedPasswords = new Set([
  "111111111111111",
  "123456789012345",
]);

interface PasswordPolicyDependencies {
  readonly compromiseChecker?: PasswordCompromiseChecker;
  readonly compromiseDigester?: PasswordCompromiseDigester;
}

interface AcceptedPassword {
  readonly accepted: true;
  readonly preparedNfcPassword: string;
}

type InternalPasswordPolicyResult =
  | AcceptedPassword
  | Exclude<PasswordPolicyResult, { readonly accepted: true }>;

export async function evaluatePasswordPolicy(
  input: PasswordPolicyInput,
  dependencies: PasswordPolicyDependencies = {},
): Promise<PasswordPolicyResult> {
  const result = await preparePassword(input, dependencies);
  return result.accepted
    ? { accepted: true }
    : result;
}

export async function withAcceptedPassword(
  input: PasswordPolicyInput,
  operation: (preparedNfcPassword: string) => Promise<unknown>,
  dependencies: PasswordPolicyDependencies = {},
): Promise<PasswordPolicyResult> {
  const result = await preparePassword(input, dependencies);
  if (!result.accepted) {
    return result;
  }

  await operation(result.preparedNfcPassword);
  return { accepted: true };
}

async function preparePassword(
  input: PasswordPolicyInput,
  dependencies: PasswordPolicyDependencies,
): Promise<InternalPasswordPolicyResult> {
  if (!isWellFormedString(input.password)) {
    return rejected("INVALID_INPUT");
  }

  const rawLength = codePointLength(input.password);
  if (rawLength < MIN_PASSWORD_CODE_POINTS) {
    return rejected("TOO_SHORT");
  }
  if (rawLength > MAX_PASSWORD_CODE_POINTS) {
    return rejected("TOO_LONG");
  }

  const preparedNfcPassword = input.password.normalize("NFC");
  const preparedLength = codePointLength(preparedNfcPassword);
  if (preparedLength < MIN_PASSWORD_CODE_POINTS) {
    return rejected("TOO_SHORT");
  }
  if (preparedLength > MAX_PASSWORD_CODE_POINTS) {
    return rejected("TOO_LONG");
  }

  const comparisonValue = preparedNfcPassword.toLocaleLowerCase("und");
  if (commonPasswords.has(comparisonValue)) {
    return rejected("COMMON_PASSWORD");
  }
  if (isContextualPassword(comparisonValue, input)) {
    return rejected("CONTEXTUAL_PASSWORD");
  }

  if (locallyCompromisedPasswords.has(preparedNfcPassword)) {
    return rejected("COMPROMISED_PASSWORD");
  }

  const { compromiseChecker, compromiseDigester } = dependencies;
  if ((compromiseChecker === undefined) !== (compromiseDigester === undefined)) {
    return rejected("COMPROMISED_PASSWORD");
  }

  if (compromiseChecker !== undefined && compromiseDigester !== undefined) {
    try {
      const digest = await compromiseDigester.digest(preparedNfcPassword);
      if (!isValidCompromiseDigest(digest)) {
        return rejected("COMPROMISED_PASSWORD");
      }
      const compromisedSuffixes = await compromiseChecker
        .getCompromisedSuffixes(digest.prefix);
      if (!isValidCompromiseSuffixes(compromisedSuffixes)) {
        return rejected("COMPROMISED_PASSWORD");
      }
      if (compromisedSuffixes.includes(digest.suffix)) {
        return rejected("COMPROMISED_PASSWORD");
      }
    } catch {
      return rejected("COMPROMISED_PASSWORD");
    }
  }

  return { accepted: true, preparedNfcPassword };
}

function isValidCompromiseSuffixes(
  values: readonly string[],
): boolean {
  return Array.isArray(values)
    && values.every((value) => /^[0-9A-F]{35}$/.test(value));
}

function isValidCompromiseDigest(
  value: PasswordCompromiseDigest,
): boolean {
  return /^[0-9A-F]{5}$/.test(value?.prefix)
    && /^[0-9A-F]{35}$/.test(value?.suffix);
}

function isContextualPassword(
  comparisonValue: string,
  input: PasswordPolicyInput,
): boolean {
  if (comparisonValue.includes("passvero")) {
    return true;
  }

  const emailLocalPart = typeof input.normalizedEmail === "string"
    ? input.normalizedEmail.split("@", 1)[0]?.normalize("NFC").toLocaleLowerCase("und")
    : undefined;
  if (emailLocalPart && comparisonValue === emailLocalPart) {
    return true;
  }

  const displayName = typeof input.displayName === "string"
    ? input.displayName.normalize("NFC").toLocaleLowerCase("und")
    : undefined;
  return displayName !== undefined
    && displayName.length > 0
    && comparisonValue === displayName;
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function isWellFormedString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) {
        return false;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }

  return true;
}

function rejected(
  reason: PasswordPolicyRejectionReason,
): Exclude<PasswordPolicyResult, { readonly accepted: true }> {
  return { accepted: false, reason };
}
