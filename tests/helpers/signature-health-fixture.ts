import type { SignatureHealthEvidence } from "../../src/application/documents/malware-scan";
import { diskManifest } from "../../src/infrastructure/documents/freshclam-evidence";
/** Synthetic evidence only; not an operational transcript or cryptographic-validation proof. */
export function healthFixture(now: number): SignatureHealthEvidence {
  const components: SignatureHealthEvidence["disk"]["components"] = [
    { name: "main", version: 63, sha256: "a".repeat(64) },
    { name: "daily", version: 28123, sha256: "b".repeat(64) },
    { name: "bytecode", version: 339, sha256: "c".repeat(64) },
  ];
  return { observedAt: now, expiresAt: now + 60_000, observationSequence: 1,
    updater: { completedAt: now - 100, result: "ALREADY_CURRENT" },
    disk: { components, manifestSha256: diskManifest(components) },
    daemon: { scanner: "clamav", engineVersion: "1.5.3", dailyVersion: 28123, dailyPublishedAt: now - 1000 } };
}

export function snapshotFixture(now: number, socketPath: string) {
  const { observedAt, expiresAt, observationSequence, ...evidence } = healthFixture(now);
  return { schemaVersion: 2, status: "HEALTHY", socketPath, observedAt, expiresAt, observationSequence, evidence };
}
