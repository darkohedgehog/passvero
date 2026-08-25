import { createHmac } from "node:crypto";

import type {
  AuthAbuseBucketKey,
  AuthAbuseDimension,
  AuthAbuseEndpoint,
} from "../../application/auth/auth-abuse-types";

const DIGEST_KEY_MINIMUM_BYTES = 32;
const errorMessage = "Auth abuse digest key configuration is invalid.";

const namespaces: Readonly<Record<AuthAbuseDimension, string>> = {
  GLOBAL_ENDPOINT: "AUTH_ABUSE_GLOBAL_V1",
  TRUSTED_NETWORK: "AUTH_ABUSE_NETWORK_V1",
  ACCOUNT_IDENTIFIER: "AUTH_ABUSE_ACCOUNT_V1",
  ACCOUNT_AND_TRUSTED_NETWORK: "AUTH_ABUSE_ACCOUNT_NETWORK_V1",
};

export function createAuthAbuseKeyDeriver(secret: Uint8Array) {
  const key = Buffer.from(secret);
  if (key.byteLength < DIGEST_KEY_MINIMUM_BYTES) {
    key.fill(0);
    throw new Error(errorMessage);
  }

  return (input: {
    readonly endpoint: AuthAbuseEndpoint;
    readonly canonicalAccountIdentifier?: string;
    readonly trustedNetwork?: string;
  }): readonly AuthAbuseBucketKey[] => {
    const keys: AuthAbuseBucketKey[] = [
      derive(key, "GLOBAL_ENDPOINT", input.endpoint, []),
    ];
    if (input.trustedNetwork !== undefined) {
      keys.push(derive(
        key,
        "TRUSTED_NETWORK",
        input.endpoint,
        [input.trustedNetwork],
      ));
    }
    if (input.canonicalAccountIdentifier !== undefined) {
      keys.push(derive(
        key,
        "ACCOUNT_IDENTIFIER",
        input.endpoint,
        [input.canonicalAccountIdentifier],
      ));
    }
    if (
      input.canonicalAccountIdentifier !== undefined
      && input.trustedNetwork !== undefined
    ) {
      keys.push(derive(
        key,
        "ACCOUNT_AND_TRUSTED_NETWORK",
        input.endpoint,
        [input.canonicalAccountIdentifier, input.trustedNetwork],
      ));
    }
    return keys;
  };
}

function derive(
  key: Buffer,
  dimension: AuthAbuseDimension,
  endpoint: AuthAbuseEndpoint,
  components: readonly string[],
): AuthAbuseBucketKey {
  const payload = encode([
    Buffer.from(namespaces[dimension], "utf8"),
    Buffer.from(endpoint, "utf8"),
    ...components.map((component) => Buffer.from(component, "utf8")),
  ]);
  return {
    dimension,
    endpoint,
    keyDigest: createHmac("sha256", key).update(payload).digest("base64url"),
  };
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
