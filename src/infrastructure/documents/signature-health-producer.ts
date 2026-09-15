import { signatureHealthEvidenceSchema, trustedProvenance } from "@/src/application/documents/malware-scan";
import { diskManifest, parseDaemonVersion, parseFreshclamEvidence, type DiskArtifact } from "./freshclam-evidence";

export interface ProducerObservation {
  /** Stable root/operator-approved source capture. Never application/request data. */
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
export function createSignatureHealthProducer(socketPath: string, io: ProducerIO, clock = { now: Date.now, monotonic: () => performance.now() }) {
  let busy = false;
  return async function run(): Promise<ProducerResult> {
    if (busy) return "BUSY";
    busy = true;
    let locked = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let work: Promise<Uint8Array> | undefined;
    const controller = new AbortController();
    let publicationAttempted = false;
    let collectionSettled = false;
    let result: ProducerResult = "OPERATIONAL_FAILURE";
    try {
      locked = await io.acquire();
      if (!locked) return "BUSY";
      const sequence = await io.nextSequence();
      const observedAt = clock.now(); const start = clock.monotonic();
      const check = () => {
        if (controller.signal.aborted || clock.monotonic() - start >= 5000 || clock.now() < observedAt) throw new Error("UNTRUSTED");
      };
      work = (async () => {
        const first = await io.collect(controller.signal); check();
        const before = parseDaemonVersion(await io.version(controller.signal)); check();
        const updater = parseFreshclamEvidence(first.updaterLog, first.components, observedAt); check();
        // Conservative: a retained daemon error remains untrusted until an operator establishes a fresh log baseline.
        if (/ERROR|WARNING|failed|failure|RELOADING/i.test(first.daemonLog)) throw new Error("UNTRUSTED");
        const second = await io.collect(controller.signal); check();
        const after = parseDaemonVersion(await io.version(controller.signal)); check();
        if (JSON.stringify(first) !== JSON.stringify(second) || JSON.stringify(before) !== JSON.stringify(after)) throw new Error("UNTRUSTED");
        const evidence = signatureHealthEvidenceSchema.parse({ observedAt, expiresAt: Math.min(observedAt + 60_000, updater.completedAt + 86_400_000), observationSequence: sequence,
          updater, disk: { components: first.components, manifestSha256: diskManifest(first.components) }, daemon: after });
        if (!trustedProvenance(evidence, clock.now())) throw new Error("UNTRUSTED");
        check();
        const { observedAt: captured, expiresAt, observationSequence, ...details } = evidence;
        const bytes = Buffer.from(JSON.stringify({ schemaVersion: 2, status: "HEALTHY", socketPath, observedAt: captured, expiresAt, observationSequence, evidence: details }));
        if (bytes.length > 16384) throw new Error("UNTRUSTED");
        return bytes;
      })().finally(() => { collectionSettled = true; });
      const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("UNTRUSTED")); }, 5000); });
      const bytes = await Promise.race([work, expired]); collectionSettled = true; check();
      clearTimeout(timer);
      publicationAttempted = true;
      await io.publish(bytes);
      result = "PUBLISHED";
    } catch {
      if (locked) {
        try { await io.invalidate(); result = publicationAttempted ? "OPERATIONAL_FAILURE" : "UNTRUSTED"; }
        catch { result = "OPERATIONAL_FAILURE"; }
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
        try { await cleanup(); } catch { result = "OPERATIONAL_FAILURE"; }
      }
    }
    return result;
  };
}
