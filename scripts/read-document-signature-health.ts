/** Read-only operator probe using exactly the application's private reader. No scan/DB. */
import { signatureHealthEvidenceSchema } from "../src/application/documents/malware-scan";
import { createSignatureHealthProvider } from "../src/infrastructure/documents/signature-health-reader";

async function main() {
  if (process.getuid?.() !== 1001 || process.argv.length !== 2) {
    console.log(JSON.stringify({ accepted: false }));
    process.exitCode = 1;
    return;
  }
  const raw = await createSignatureHealthProvider({
    path: "/var/lib/passvero-signature-health/health.json",
    socketPath: "/run/clamav/clamd.ctl",
  }).read({ signal: AbortSignal.timeout(2500) });
  const parsed = signatureHealthEvidenceSchema.safeParse(raw);
  const evidence = parsed.success ? parsed.data : null;
  console.log(JSON.stringify(evidence ? {
    accepted: true, sequence: evidence.observationSequence,
    observedAt: evidence.observedAt, expiresAt: evidence.expiresAt,
  } : { accepted: false }));
  process.exitCode = evidence ? 0 : 1;
}
void main();
