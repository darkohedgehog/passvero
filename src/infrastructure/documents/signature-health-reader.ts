import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { dirname, parse } from "node:path";
import { z } from "zod";
import { signatureHealthEvidenceSchema, trustedProvenance, type SignatureHealthPort } from "@/src/application/documents/malware-scan";
import { trustedScanPathSchema } from "./document-scan-config";

const MAX_BYTES = 16 * 1024;
const IO_DEADLINE_MS = 2000;
export interface PrivateHealthSnapshotReader {
  /** Return only a stable, private snapshot; enforce the cap before returning bytes. */
  read(path: string, options: { readonly signal: AbortSignal; readonly limit: number }): Promise<Uint8Array>;
}
export const snapshotSchema = z.object({
  schemaVersion: z.literal(2),
  socketPath: trustedScanPathSchema.max(100),
  status: z.literal("HEALTHY"),
  observedAt: z.number().int().nonnegative().safe(),
  expiresAt: z.number().int().nonnegative().safe(),
  observationSequence: z.number().int().nonnegative().safe(),
  evidence: signatureHealthEvidenceSchema.omit({ observedAt: true, expiresAt: true, observationSequence: true }),
}).strict();

/** Root producer in deployment. The optional owner seam is for isolated local fixtures. */
export function createPrivateHealthSnapshotReader(trustedOwnerUid = 0): PrivateHealthSnapshotReader {
  return {
    async read(path, { signal, limit }) {
      if (!trustedScanPathSchema.safeParse(path).success || limit !== MAX_BYTES) throw new Error("HEALTH_UNAVAILABLE");
      let handle: FileHandle | undefined;
      const end = performance.now() + IO_DEADLINE_MS;
      const check = () => { if (signal.aborted || performance.now() >= end) throw new Error("HEALTH_UNAVAILABLE"); };
      const privateFile = (stat: Stats) => {
        if (!stat.isFile() || stat.uid !== trustedOwnerUid || ![0o600, 0o640].includes(stat.mode & 0o777) || stat.nlink !== 1
          || stat.size < 1 || stat.size > MAX_BYTES) throw new Error("HEALTH_UNAVAILABLE");
      };
      try {
        check();
        // Require root-owned, non-writable parents. Test fixture owners may own their private subtree.
        let parent = dirname(path);
        while (true) {
          const stat = await lstat(parent); check();
          if (!stat.isDirectory() || ![0, trustedOwnerUid].includes(stat.uid) || (stat.mode & 0o022) !== 0) throw new Error("HEALTH_UNAVAILABLE");
          if (parent === parse(parent).root) break;
          parent = dirname(parent);
        }
        const before = await lstat(path); check(); privateFile(before);
        // NONBLOCK avoids blocking on a substituted FIFO/device; fstat rejects non-regular files.
        handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); check();
        const opened = await handle.stat(); check(); privateFile(opened);
        if (opened.ino !== before.ino || opened.dev !== before.dev) throw new Error("HEALTH_UNAVAILABLE");
        const buffer = Buffer.alloc(MAX_BYTES + 1);
        let total = 0;
        while (total < buffer.length) {
          check();
          const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
          check(); if (!bytesRead) break; total += bytesRead;
        }
        const after = await handle.stat(); const current = await lstat(path); check();
        privateFile(after); privateFile(current);
        for (const stat of [after, current]) {
          if (stat.dev !== opened.dev || stat.ino !== opened.ino || stat.size !== opened.size
            || stat.mtimeMs !== opened.mtimeMs || stat.ctimeMs !== opened.ctimeMs) throw new Error("HEALTH_UNAVAILABLE");
        }
        if (total !== opened.size || total > MAX_BYTES) throw new Error("HEALTH_UNAVAILABLE");
        return buffer.subarray(0, total);
      } catch { throw new Error("HEALTH_UNAVAILABLE"); }
      finally { await handle?.close().catch(() => { throw new Error("HEALTH_UNAVAILABLE"); }); }
    },
  };
}
export function createSignatureHealthProvider(config: {
  readonly path: string;
  readonly socketPath: string;
}, reader: PrivateHealthSnapshotReader = createPrivateHealthSnapshotReader(), now: () => number = Date.now): SignatureHealthPort {
  const path = config.path; const socketPath = config.socketPath;
  let reading = false;
  let newest = -1;
  let newestObserved = -1;
  let newestText = "";
  return {
    async read({ signal }) {
      if (signal.aborted || reading) return null;
      reading = true;
      const controller = new AbortController();
      let finish!: () => void;
      const interrupted = new Promise<null>(resolve => { finish = () => { controller.abort(); resolve(null); }; });
      const timer = setTimeout(finish, IO_DEADLINE_MS);
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted) finish();
      try {
        const work = Promise.resolve().then(() => reader.read(path, { signal: controller.signal, limit: MAX_BYTES }))
          .catch(() => null).finally(() => { reading = false; });
        const bytes = await Promise.race([work, interrupted]);
        if (!bytes || signal.aborted || controller.signal.aborted || bytes.byteLength > MAX_BYTES) return null;
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
        const decoded: unknown = JSON.parse(text);
        // Require the producer's compact JSON encoding: rejects duplicate/conflicting keys as well.
        if (JSON.stringify(decoded) !== text) return null;
        const parsed = snapshotSchema.safeParse(decoded);
        if (!parsed.success) return null;
        const snapshot = parsed.data; const current = now();
        const evidence = { ...snapshot.evidence, observedAt: snapshot.observedAt, expiresAt: snapshot.expiresAt, observationSequence: snapshot.observationSequence };
        if (snapshot.socketPath !== socketPath || snapshot.observationSequence < newest
          || snapshot.observedAt < newestObserved
          || (snapshot.observationSequence === newest && text !== newestText)
          || createHash("sha256").update(JSON.stringify(snapshot.evidence.disk.components)).digest("hex") !== snapshot.evidence.disk.manifestSha256
          || !trustedProvenance(evidence, current)) return null;
        newestText = text;
        newest = snapshot.observationSequence;
        newestObserved = snapshot.observedAt;
        return evidence;
      } catch { return null; }
      finally { clearTimeout(timer); signal.removeEventListener("abort", finish); }
    },
  };
}
