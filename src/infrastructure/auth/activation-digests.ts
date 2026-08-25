import { createHmac, timingSafeEqual } from "node:crypto";

const CAPABILITY_NAMESPACE = "passvero-auth-activation-capability";
const EMAIL_NAMESPACE = "passvero-auth-activation-target-email";
const VERSION = "v1";
const KEY_BYTES = 32;
const CAPABILITY_BYTES = 32;
const DIGEST_BYTES = 32;
const ENCODED_LENGTH = 43;
const errorMessage = "Activation digest key configuration is invalid.";

export function createActivationDigesters(input: {
  readonly capabilityKey: Uint8Array;
  readonly emailKey: Uint8Array;
}) {
  const capabilityKey = Buffer.from(input.capabilityKey);
  const emailKey = Buffer.from(input.emailKey);
  if (
    capabilityKey.length !== KEY_BYTES
    || emailKey.length !== KEY_BYTES
    || timingSafeEqual(capabilityKey, emailKey)
  ) {
    capabilityKey.fill(0);
    emailKey.fill(0);
    throw new Error(errorMessage);
  }

  return {
    capabilityDigester: {
      async digest(capability: string): Promise<string | null> {
        const bytes = decodeCanonicalBase64Url(capability, CAPABILITY_BYTES);
        if (bytes === null) {
          return null;
        }
        try {
          return digest(
            capabilityKey,
            CAPABILITY_NAMESPACE,
            bytes,
          ).toString("base64url");
        } finally {
          bytes.fill(0);
        }
      },
    },
    intendedEmailDigester: {
      async matches(matchInput: {
        readonly canonicalEmail: string;
        readonly persistedDigest: string;
      }): Promise<boolean> {
        const persisted = decodeCanonicalBase64Url(
          matchInput.persistedDigest,
          DIGEST_BYTES,
        );
        if (persisted === null) {
          return false;
        }
        const emailBytes = Buffer.from(matchInput.canonicalEmail, "utf8");
        const expected = digest(emailKey, EMAIL_NAMESPACE, emailBytes);
        try {
          return timingSafeEqual(expected, persisted);
        } finally {
          emailBytes.fill(0);
          expected.fill(0);
          persisted.fill(0);
        }
      },
    },
  };
}

function digest(
  key: Buffer,
  namespace: string,
  value: Uint8Array,
): Buffer {
  return createHmac("sha256", key)
    .update(encode([
      Buffer.from(namespace, "utf8"),
      Buffer.from(VERSION, "utf8"),
      value,
    ]))
    .digest();
}

function encode(parts: readonly Uint8Array[]): Buffer {
  const encoded: Buffer[] = [];
  for (const part of parts) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(part.byteLength);
    encoded.push(length, Buffer.from(part));
  }
  return Buffer.concat(encoded);
}

function decodeCanonicalBase64Url(
  value: unknown,
  expectedBytes: number,
): Buffer | null {
  if (
    typeof value !== "string"
    || value.length !== ENCODED_LENGTH
    || !/^[A-Za-z0-9_-]{43}$/.test(value)
  ) {
    return null;
  }

  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.length !== expectedBytes
    || decoded.toString("base64url") !== value
  ) {
    decoded.fill(0);
    return null;
  }
  return decoded;
}
