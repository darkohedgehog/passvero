import { signatureHealthEvidenceSchema, trustedProvenance } from "@/src/application/documents/malware-scan";
import { diskManifest, parseDaemonVersion, parseFreshclamEvidence, validateDaemonEvidence, type EvidenceTimeZone, type DiskArtifact } from "./freshclam-evidence";

export interface ProducerObservation {
  /** Stable root/operator-approved source capture. Never application/request data. */
  timeZone: EvidenceTimeZone;
  updaterLog: string;
  daemonLog: string;
  components: DiskArtifact[];
  sourceIdentity: string;
}
export interface ProducerIO {
  /** Exclusive OS-backed writer lock; held until all outstanding collection settles. */
  acquire(): Promise<boolean>;
  release(): Promise<void>;
  nextSequence(): Promise<number>;
  collect(signal: AbortSignal): Promise<ProducerObservation>;
  version(signal: AbortSignal): Promise<string>;
  publish(bytes: Uint8Array): Promise<void>;
  invalidate(): Promise<void>;
}
export type ProducerResult = "PUBLISHED" | "UNTRUSTED" | "BUSY" | "OPERATIONAL_FAILURE";
const evidenceReasons = [
  "CANCELLED", "CONFIGURATION_CHANGED", "CONFIGURATION_INVALID", "DAEMON_LOG_INCOMPLETE",
  "DAEMON_UNAVAILABLE", "DATABASE_INVALID", "DATABASE_SET_UNCERTAIN", "INPUT_BOUND",
  "INPUT_CHANGED", "LOCK_REQUIRED", "OWNER_REQUIRED", "PRIVATE_INPUT_REQUIRED",
  "PUBLICATION_INVALID", "SEQUENCE_INVALID", "SEQUENCE_LOST", "EVIDENCE_INVALID",
  "EVIDENCE_CONTINUITY_REQUIRED", "DAEMON_UNCERTAIN", "DEADLINE_EXCEEDED",
  "CLOCK_MOVED_BACKWARDS", "OBSERVATION_CHANGED", "HEALTH_IDENTITY_INVALID",
] as const;
export type ProducerReason = typeof evidenceReasons[number] | "UNKNOWN_FAILURE" | "INPUT_UNAVAILABLE"
  | "PUBLICATION_FAILED" | "INVALIDATION_FAILED" | "RELEASE_FAILED";
export type ProducerPhase = "ACQUIRE" | "SEQUENCE" | "COLLECT" | "VERSION" | "UPDATER"
  | "DAEMON" | "COMPARE" | "VALIDATE" | "PUBLISH" | "INVALIDATE" | "RELEASE" | "COMPLETE";
export interface ProducerReport {
  result: ProducerResult;
  reason: ProducerReason | null;
  phase: ProducerPhase;
  /** Whole invocation through synchronous cleanup, not a changed collection budget. */
  durationMs: number;
}
function reasonFor(error: unknown): ProducerReason {
  if (error instanceof Error) {
    const known = evidenceReasons.find(code => code === error.message);
    if (known) return known;
    if ("code" in error && error.code === "ENOENT") return "INPUT_UNAVAILABLE";
  }
  return "UNKNOWN_FAILURE";
}
export function createSignatureHealthProducer(socketPath: string, io: ProducerIO, clock = { now: Date.now, monotonic: () => performance.now() }) {
  let busy = false;
  return async function run(): Promise<ProducerReport> {
    if (busy) return { result: "BUSY", reason: null, phase: "ACQUIRE", durationMs: 0 } satisfies ProducerReport;
    busy = true;
    const invokedAt = clock.monotonic();
    let reason: ProducerReason | null = null;
    let phase: ProducerPhase = "ACQUIRE";
    let locked = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let work: Promise<Uint8Array> | undefined;
    const controller = new AbortController();
    let publicationAttempted = false;
    let collectionSettled = false;
    let result: ProducerResult = "OPERATIONAL_FAILURE";
    try {
      locked = await io.acquire();
      if (!locked) return { result: "BUSY", reason: null, phase, durationMs: Math.max(0, clock.monotonic() - invokedAt) };
      phase = "SEQUENCE";
      const sequence = await io.nextSequence();
      const observedAt = clock.now(); const start = clock.monotonic();
      const check = () => {
        if (controller.signal.aborted || clock.monotonic() - start >= 5000) throw new Error("DEADLINE_EXCEEDED");
        if (clock.now() < observedAt) throw new Error("CLOCK_MOVED_BACKWARDS");
      };
      work = (async () => {
        phase = "COLLECT";
        const first = await io.collect(controller.signal); check();
        phase = "VERSION";
        const before = parseDaemonVersion(await io.version(controller.signal), first.timeZone); check();
        phase = "UPDATER";
        const updater = parseFreshclamEvidence(first.updaterLog, first.components, observedAt, first.timeZone); check();
        phase = "DAEMON";
        validateDaemonEvidence(first.daemonLog, observedAt, first.timeZone); check();
        phase = "COLLECT";
        const second = await io.collect(controller.signal); check();
        phase = "VERSION";
        const after = parseDaemonVersion(await io.version(controller.signal), first.timeZone); check();
        phase = "COMPARE";
        if (JSON.stringify(first) !== JSON.stringify(second) || JSON.stringify(before) !== JSON.stringify(after)) throw new Error("OBSERVATION_CHANGED");
        phase = "VALIDATE";
        const evidence = signatureHealthEvidenceSchema.parse({ observedAt, expiresAt: Math.min(observedAt + 60_000, updater.completedAt + 86_400_000), observationSequence: sequence,
          updater, disk: { components: first.components, manifestSha256: diskManifest(first.components) }, daemon: after });
        if (!trustedProvenance(evidence, clock.now())) throw new Error("HEALTH_IDENTITY_INVALID");
        check();
        const { observedAt: captured, expiresAt, observationSequence, ...details } = evidence;
        const bytes = Buffer.from(JSON.stringify({ schemaVersion: 2, status: "HEALTHY", socketPath, observedAt: captured, expiresAt, observationSequence, evidence: details }));
        if (bytes.length > 16384) throw new Error("HEALTH_IDENTITY_INVALID");
        return bytes;
      })().finally(() => { collectionSettled = true; });
      const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("DEADLINE_EXCEEDED")); }, 5000); });
      const bytes = await Promise.race([work, expired]); collectionSettled = true; check();
      clearTimeout(timer);
      phase = "PUBLISH";
      publicationAttempted = true;
      await io.publish(bytes);
      result = "PUBLISHED";
    } catch (error) {
      reason = publicationAttempted ? "PUBLICATION_FAILED" : reasonFor(error);
      if (locked) {
        try { await io.invalidate(); result = publicationAttempted ? "OPERATIONAL_FAILURE" : "UNTRUSTED"; }
        catch { result = "OPERATIONAL_FAILURE"; reason = "INVALIDATION_FAILED"; phase = "INVALIDATE"; }
      }
    } finally {
      clearTimeout(timer); controller.abort();
      // No timed-out collector can later publish. Retain the slot/lock until it settles.
      const cleanup = async () => {
        try { if (locked) await io.release(); } finally { busy = false; }
      };
      if (work && !collectionSettled) {
        // Collection uses bounded local I/O, but a stalled OS call may outlive the response deadline.
        void work.catch(() => undefined).then(cleanup).catch(() => undefined);
      } else {
        try { await cleanup(); } catch {
          result = "OPERATIONAL_FAILURE";
          if (reason !== "INVALIDATION_FAILED") { reason = "RELEASE_FAILED"; phase = "RELEASE"; }
        }
      }
    }
    return { result, reason, phase: result === "PUBLISHED" ? "COMPLETE" : phase, durationMs: Math.max(0, clock.monotonic() - invokedAt) };
  };
}
