import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { withAcceptedPassword } from "@/src/application/auth/password-policy";

const SCRYPT_N = 16_384;
const SCRYPT_R = 16;
const SCRYPT_P = 1;
const SCRYPT_DERIVED_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 128 * SCRYPT_N * SCRYPT_R * 2;
const SALT_LENGTH = 16;
const ENVELOPE_PREFIX = "$passvero$scrypt$v=1$N=16384$r=16$p=1$dkLen=64$";
const ENCODED_SALT_LENGTH = 22;
const ENCODED_KEY_LENGTH = 86;
const ENVELOPE_LENGTH = ENVELOPE_PREFIX.length
  + ENCODED_SALT_LENGTH
  + 1
  + ENCODED_KEY_LENGTH;
const ENVELOPE_PATTERN = /^\$passvero\$scrypt\$v=1\$N=16384\$r=16\$p=1\$dkLen=64\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/;
const GENERIC_FAILURE_MESSAGE = "Password credential operation failed.";

interface ParsedPasswordEnvelope {
  readonly salt: Buffer;
  readonly expectedKey: Buffer;
}

export function createPassveroPasswordCallbacks(): {
  readonly hash: (password: string) => Promise<string>;
  readonly verify: (input: {
    readonly hash: string;
    readonly password: string;
  }) => Promise<boolean>;
} {
  return {
    hash: hashPasswordWithPolicy,
    verify: verifyPreparedNfcPassword,
  };
}

async function hashPasswordWithPolicy(password: string): Promise<string> {
  let passwordHash: string | undefined;

  try {
    const result = await withAcceptedPassword(
      { password },
      async (preparedNfcPassword) => {
        passwordHash = await hashPreparedNfcPassword(preparedNfcPassword);
      },
    );

    if (!result.accepted || passwordHash === undefined) {
      throw new Error(GENERIC_FAILURE_MESSAGE);
    }

    return passwordHash;
  } catch {
    throw new Error(GENERIC_FAILURE_MESSAGE);
  }
}

async function hashPreparedNfcPassword(password: string): Promise<string> {
  let salt: Buffer | undefined;
  let passwordBytes: Buffer | undefined;
  let derivedKey: Buffer | undefined;

  try {
    if (!isWellFormedString(password)) {
      throw new Error(GENERIC_FAILURE_MESSAGE);
    }

    salt = randomBytes(SALT_LENGTH);
    passwordBytes = Buffer.from(password, "utf8");
    derivedKey = await deriveKey(passwordBytes, salt);

    return `${ENVELOPE_PREFIX}${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
  } catch {
    throw new Error(GENERIC_FAILURE_MESSAGE);
  } finally {
    salt?.fill(0);
    passwordBytes?.fill(0);
    derivedKey?.fill(0);
  }
}

async function verifyPreparedNfcPassword(input: {
  readonly hash: string;
  readonly password: string;
}): Promise<boolean> {
  if (
    typeof input?.hash !== "string"
    || !isWellFormedString(input?.password)
  ) {
    return false;
  }

  const parsed = parseEnvelope(input.hash);
  if (parsed === null) {
    return false;
  }

  let passwordBytes: Buffer | undefined;
  let derivedKey: Buffer | undefined;
  try {
    const preparedNfcPassword = input.password.normalize("NFC");
    passwordBytes = Buffer.from(preparedNfcPassword, "utf8");
    derivedKey = await deriveKey(passwordBytes, parsed.salt);

    return derivedKey.length === parsed.expectedKey.length
      && timingSafeEqual(derivedKey, parsed.expectedKey);
  } catch {
    return false;
  } finally {
    parsed.salt.fill(0);
    parsed.expectedKey.fill(0);
    passwordBytes?.fill(0);
    derivedKey?.fill(0);
  }
}

function parseEnvelope(hash: string): ParsedPasswordEnvelope | null {
  if (hash.length !== ENVELOPE_LENGTH) {
    return null;
  }

  const match = ENVELOPE_PATTERN.exec(hash);
  if (match === null) {
    return null;
  }

  const encodedSalt = match[1];
  const encodedKey = match[2];
  if (encodedSalt === undefined || encodedKey === undefined) {
    return null;
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const expectedKey = Buffer.from(encodedKey, "base64url");
  if (
    salt.length !== SALT_LENGTH
    || expectedKey.length !== SCRYPT_DERIVED_KEY_LENGTH
    || salt.toString("base64url") !== encodedSalt
    || expectedKey.toString("base64url") !== encodedKey
  ) {
    salt.fill(0);
    expectedKey.fill(0);
    return null;
  }

  return { salt, expectedKey };
}

function deriveKey(password: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_DERIVED_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
        } else {
          resolve(derivedKey);
        }
      },
    );
  });
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
