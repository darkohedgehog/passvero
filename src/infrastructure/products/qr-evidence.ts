import { createHmac, timingSafeEqual } from "node:crypto";
import type { QrEvidence, QrEvidenceClaims, QrRecord } from "@/src/application/products/qr/ports";

// Follow the existing activation-digests pattern: domain-separated HMAC and
// canonical encodings. Auth activation digesters themselves are purpose-specific.
export function createQrEvidence(secret: string): QrEvidence {
  if (secret.length < 32 || secret !== secret.trim()) throw new Error("QR evidence configuration is invalid.");
  const digest = (purpose: string, parts: readonly string[]) => createHmac("sha256", secret)
    .update(JSON.stringify(["passvero-product-qr", "v1", purpose, ...parts])).digest("base64url");
  function fingerprint(qr: QrRecord): QrEvidenceClaims {
    const identity = digest("identity", [qr.id, qr.passportId, qr.code, qr.targetUrl, qr.generatedAt.toISOString(), qr.createdAt.toISOString()]);
    return { status: qr.status, identity, revision: digest("revision", [identity, qr.status, qr.updatedAt.toISOString()]) };
  }
  return {
    fingerprint,
    issue(qr) {
      const claims = fingerprint(qr);
      const body = Buffer.from(JSON.stringify([1, claims.status, claims.identity, claims.revision])).toString("base64url");
      return `${body}.${digest("signature", [body])}`;
    },
    read(value) {
      if (typeof value !== "string" || value.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) return null;
      const [body, signature] = value.split(".");
      const expected = Buffer.from(digest("signature", [body]), "base64url");
      const actual = Buffer.from(signature, "base64url");
      if (actual.length !== expected.length || actual.toString("base64url") !== signature || !timingSafeEqual(actual, expected)) return null;
      try {
        const decoded = Buffer.from(body, "base64url");
        if (decoded.toString("base64url") !== body) return null;
        const claims: unknown = JSON.parse(decoded.toString("utf8"));
        if (!Array.isArray(claims) || claims.length !== 4 || claims[0] !== 1
          || !["PENDING", "ACTIVE", "REVOKED"].includes(claims[1])
          || typeof claims[2] !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(claims[2])
          || typeof claims[3] !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(claims[3])) return null;
        const status = claims[1];
        if (status !== "PENDING" && status !== "ACTIVE" && status !== "REVOKED") return null;
        return { status, identity: claims[2], revision: claims[3] };
      } catch { return null; }
    },
  };
}
