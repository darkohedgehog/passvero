import { constants } from "node:fs";
import { lstat, open, readdir, mkdir, rmdir, rename, unlink } from "node:fs/promises";
import { dirname, parse } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Socket } from "node:net";
import { z } from "zod";
import { trustedScanPathSchema } from "./document-scan-config";
import type { ProducerIO } from "./signature-health-producer";

export const producerConfigSchema = z.object({
  timeZone: z.enum(["UTC", "Europe/Zagreb"]),
  socketPath: trustedScanPathSchema.max(100), outputPath: trustedScanPathSchema,
  updaterLog: trustedScanPathSchema, daemonLog: trustedScanPathSchema, databaseDirectory: trustedScanPathSchema,
  updaterConfig: trustedScanPathSchema, updaterConfigSha256: z.string().regex(/^[a-f0-9]{64}$/),
  scannerUid: z.number().int().positive(), outputGid: z.number().int().nonnegative(),
}).strict();
export type ProducerConfig = z.infer<typeof producerConfigSchema>;
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";
async function parents(path: string, owners: readonly number[]) {
  let parent = dirname(path);
  while (true) {
    const st = await lstat(parent);
    if (!st.isDirectory() || !owners.includes(st.uid) || (st.mode & 0o022)) throw new Error("PRIVATE_INPUT_REQUIRED");
    if (parent === parse(parent).root) return;
    parent = dirname(parent);
  }
}
async function readStable(path: string, owners: readonly number[], cap: number, signal: AbortSignal, hashOnly = false) {
  const check = () => { if (signal.aborted) throw new Error("CANCELLED"); };
  check(); await parents(path, [0, ...owners]); check();
  const before = await lstat(path);
  const valid = (st: typeof before) => st.isFile() && owners.includes(st.uid) && !(st.mode & 0o022) && st.nlink === 1 && st.size > 0 && st.size <= cap;
  if (!valid(before)) throw new Error("PRIVATE_INPUT_REQUIRED");
  const f = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const st = await f.stat();
    if (!valid(st) || st.ino !== before.ino || st.dev !== before.dev) throw new Error("INPUT_CHANGED");
    const hash = createHash("sha256"); const payload = createHash("md5"); const chunks: Buffer[] = []; let length = 0; let header = Buffer.alloc(0);
    while (length <= cap) {
      check(); const buffer = Buffer.alloc(Math.min(65536, cap + 1 - length));
      const { bytesRead } = await f.read(buffer, 0, buffer.length, length); check();
      if (!bytesRead) break;
      const bytes = buffer.subarray(0, bytesRead); hash.update(bytes);
      if (hashOnly && length + bytesRead > 512) payload.update(bytes.subarray(Math.max(0, 512 - length)));
      if (!header.length) header = Buffer.from(bytes.subarray(0, 512));
      if (!hashOnly) chunks.push(bytes);
      length += bytesRead;
    }
    for (const after of [await f.stat(), await lstat(path)]) {
      if (!valid(after) || after.ino !== st.ino || after.dev !== st.dev || after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) throw new Error("INPUT_CHANGED");
    }
    if (length !== st.size || length > cap) throw new Error("INPUT_BOUND");
    check(); return { text: hashOnly ? header.toString("ascii") : new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)), sha256: hash.digest("hex"), payloadMd5: payload.digest("hex") };
  } finally { await f.close(); }
}
export function readDaemonVersion(socketPath: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket(); let bytes = Buffer.alloc(0); let done = false;
    const finish = (ok: boolean) => {
      if (done) return; done = true; clearTimeout(timer); signal.removeEventListener("abort", abort); socket.destroy();
      if (ok) resolve(bytes.toString("ascii")); else reject(new Error("DAEMON_UNAVAILABLE"));
    };
    const abort = () => finish(false);
    const timer = setTimeout(abort, 2000);
    socket.once("connect", () => socket.write("zVERSION\0"));
    socket.on("data", data => { if (bytes.length + data.length > 4096 || data.some((b: number) => b > 127)) return abort(); bytes = Buffer.concat([bytes, data]); });
    socket.once("end", () => finish(bytes.length > 0)); socket.once("error", abort); socket.once("close", () => { if (!done) abort(); });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort(); else socket.connect(socketPath);
  });
}
/** The owner override is solely for isolated local fixtures; the operational entry point uses root. */
export function createProducerIO(input: unknown, ownerUid = 0): ProducerIO {
  const c = producerConfigSchema.parse(input);
  const protectedPaths = [c.socketPath, c.updaterLog, c.daemonLog, c.databaseDirectory, c.updaterConfig];
  if ([c.outputPath, `${c.outputPath}.lock`, `${c.outputPath}.sequence`].some(path => protectedPaths.includes(path) || path.startsWith(`${c.databaseDirectory}/`))) throw new Error("CONFIGURATION_INVALID");
  const lock = `${c.outputPath}.lock`; const counter = `${c.outputPath}.sequence`;
  const controller = new AbortController();
  let acquired = false;
  async function removeOutput() { await parents(c.outputPath, [0, ownerUid]); await unlink(c.outputPath).catch(e => { if (!missing(e)) throw e; }); }
  async function atomic(path: string, bytes: Uint8Array) {
    await parents(path, [0, ownerUid]);
    const temp = `${path}.${randomUUID()}.tmp`;
    const f = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, path === c.outputPath ? 0o640 : 0o600);
    try {
      if (path === c.outputPath) await f.chown(ownerUid, c.outputGid);
      await f.writeFile(bytes); await f.sync(); await f.close();
      await rename(temp, path);
      const directory = await open(dirname(path), constants.O_RDONLY); try { await directory.sync(); } finally { await directory.close(); }
    } catch (e) { await f.close().catch(() => undefined); await unlink(temp).catch(() => undefined); throw e; }
  }
  return {
    async acquire() {
      await parents(c.outputPath, [0, ownerUid]);
      if (process.getuid?.() !== ownerUid) throw new Error("OWNER_REQUIRED");
      try { await mkdir(lock, { mode: 0o700 }); acquired = true; return true; }
      catch (e) { if ((e as NodeJS.ErrnoException).code === "EEXIST") return false; throw e; }
    },
    async release() { if (acquired) { await rmdir(lock); acquired = false; } },
    async nextSequence() {
      if (!acquired) throw new Error("LOCK_REQUIRED");
      let previous = 0;
      try {
        const raw = await readStable(counter, [ownerUid], 32, controller.signal);
        if (!/^[1-9]\d*\n$/.test(raw.text)) throw new Error("SEQUENCE_INVALID");
        previous = Number(raw.text);
      } catch (e) {
        if (!missing(e)) throw e;
        // Never silently reset an existing published observation after counter loss.
        try { await lstat(c.outputPath); throw new Error("SEQUENCE_LOST"); } catch (x) { if (!missing(x)) throw x; }
      }
      if (!Number.isSafeInteger(previous + 1)) throw new Error("SEQUENCE_INVALID");
      await atomic(counter, Buffer.from(`${previous + 1}\n`)); return previous + 1;
    },
    async collect(signal) {
      const config = await readStable(c.updaterConfig, [0, ownerUid], 65536, signal);
      const directives = config.text.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#"));
      const testing = directives.filter(line => /^TestDatabases(?:\s|$)/.test(line));
      if (config.sha256 !== c.updaterConfigSha256 || testing.length !== 1 || testing[0] !== "TestDatabases yes"
        || directives.some(line => /^(DatabaseCustomURL|ExtraDatabase|ExcludeDatabase|PrivateMirror)\b/.test(line))) throw new Error("CONFIGURATION_CHANGED");
      // The grammar's completion boundary is valid only for the standard three databases.
      for (const [key, value] of [["Bytecode", "yes"], ["LogVerbose", "no"], ["LogTime", "true"]]) {
        const rows = directives.filter(line => new RegExp(`^${key}(?:\\s|$)`).test(line));
        if (rows.length !== 1 || rows[0] !== `${key} ${value}`) throw new Error("CONFIGURATION_CHANGED");
      }
      const owners = [0, ownerUid, c.scannerUid];
      const updater = await readStable(c.updaterLog, owners, 1_048_576, signal);
      const daemon = await readStable(c.daemonLog, owners, 1_048_576, signal);
      if (!daemon.text.endsWith("\n") || daemon.text.split("\n").length > 10_001) throw new Error("DAEMON_LOG_INCOMPLETE");
      const entries = await readdir(c.databaseDirectory);
      const allowed = /^(?:(?:main|daily|bytecode)\.(?:cvd|cld)|(?:main|daily|bytecode)-\d+\.(?:cvd|cld)\.sign|freshclam\.dat|freshclam\.pid)$/;
      if (entries.length > 64 || entries.some(name => !allowed.test(name))) throw new Error("DATABASE_SET_UNCERTAIN");
      const components = [];
      for (const name of ["main", "daily", "bytecode"] as const) {
        const files = entries.filter(x => x === `${name}.cvd` || x === `${name}.cld`);
        if (files.length !== 1) throw new Error("DATABASE_SET_UNCERTAIN");
        const file = await readStable(`${c.databaseDirectory}/${files[0]}`, owners, 536870912, signal, true);
        const header = file.text.split(":"); const version = Number(header[2]);
        if (header.length < 9 || header[0] !== "ClamAV-VDB" || !/^\d+$/.test(header[2]) || !/^\d+$/.test(header[3]) || !/^\d+$/.test(header[4]) || (files[0].endsWith(".cvd") && (!/^[a-fA-F0-9]{32}$/.test(header[5] ?? "") || header[5].toLowerCase() !== file.payloadMd5)) || !Number.isSafeInteger(version) || version < 1) throw new Error("DATABASE_INVALID");
        components.push({ name, version, sha256: file.sha256 });
      }
      return { timeZone: c.timeZone, updaterLog: updater.text, daemonLog: daemon.text, components,
        sourceIdentity: `${config.sha256}:${updater.sha256}:${daemon.sha256}` };
    },
    version: signal => readDaemonVersion(c.socketPath, signal),
    async publish(bytes) {
      if (!acquired || bytes.length > 16384) throw new Error("PUBLICATION_INVALID");
      await atomic(c.outputPath, bytes);
    },
    invalidate: removeOutput,
  };
}
