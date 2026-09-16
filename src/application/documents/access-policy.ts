import { DOCUMENT_SECURITY_POLICY_VERSION } from "./document-security-policy";
import type { DocumentRecord } from "./contracts";
import { scanLeaseExpired } from "./malware-scan";

export interface DocumentScanState {
  readonly status: "UNSCANNED" | "PENDING" | "CLEAN" | "INFECTED" | "ERROR";
  readonly attemptId: string | null;
  readonly startedAt: number | null;
  readonly scannedAt: number | null;
  readonly sha256: string | null;
  readonly policyVersion: number | null;
}
/** Verdict age is distinct from the short-lived health snapshot and attempt lease. */
export function cleanDocumentEligible(row: DocumentRecord, now: number): boolean {
  const scan = row.scan;
  return row.status === "AVAILABLE" && scan?.status === "CLEAN"
    && scan.policyVersion === DOCUMENT_SECURITY_POLICY_VERSION
    && scan.sha256 === row.checksumSha256 && /^[a-f0-9]{64}$/.test(scan.sha256)
    && scan.scannedAt !== null && Number.isFinite(now) && now >= scan.scannedAt
    && now - scan.scannedAt <= 7 * 24 * 60 * 60 * 1000;
}
export function documentScanStatus(row: DocumentRecord, now: number) {
  const scan = row.scan;
  const recoverable = row.status === "AVAILABLE" && scan?.status === "PENDING"
    && scan.startedAt !== null && scanLeaseExpired(scan.startedAt, now);
  return { status: scan?.status ?? "UNSCANNED", available: row.status === "AVAILABLE",
    cleanEligible: cleanDocumentEligible(row, now), recoverable,
    expectedAttemptId: recoverable ? scan?.attemptId ?? null : null };
}
