import { createHash } from "node:crypto";

const names = ["main", "daily", "bytecode"] as const;
export type DatabaseName = typeof names[number];
export interface DiskArtifact { name: DatabaseName; version: number; sha256: string }
/** ctime in C locale, UTC only. Deployment must retain this timezone/locale. */
export function clamTime(text: string): number {
  if (!/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [ \d]\d \d\d:\d\d:\d\d \d{4}$/.test(text)) throw new Error("EVIDENCE_INVALID");
  const date = new Date(`${text} GMT`);
  const canonical = date.toUTCString();
  const expected = `${canonical.slice(0, 3)} ${canonical.slice(8, 11)} ${canonical.slice(5, 7).replace(/^0/, " ")} ${canonical.slice(17, 25)} ${canonical.slice(12, 16)}`;
  if (!Number.isFinite(date.getTime()) || expected !== text) throw new Error("EVIDENCE_INVALID");
  return date.getTime();
}
/** Narrow official 1.5.3 daemon log grammar. Unknown lines fail closed, never inferred success. */
export function parseFreshclamEvidence(text: string, disk: readonly DiskArtifact[], now: number) {
  if (Buffer.byteLength(text) > 1_048_576 || !text.endsWith("\n")) throw new Error("EVIDENCE_INVALID");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length > 10_000) throw new Error("EVIDENCE_INVALID");
  let previous = -1;
  let active = false;
  let updated = false;
  let completedAt = -1;
  let result: "UPDATED" | "ALREADY_CURRENT" = "UPDATED";
  const seen = new Set<string>();
  const validated = new Map<string, number>();
  for (const line of lines) {
    const split = /^(.{24}) -> (.*)$/.exec(line);
    if (!split) throw new Error("EVIDENCE_INVALID");
    const at = clamTime(split[1]); const message = split[2];
    if (at < previous || at > now) throw new Error("EVIDENCE_INVALID");
    previous = at;
    if (/^freshclam daemon 1\.5\.3 \(OS: [A-Za-z0-9_-]+, ARCH: [A-Za-z0-9_-]+, CPU: [A-Za-z0-9_-]+\)$/.test(message)) {
      if (active || completedAt >= 0) throw new Error("EVIDENCE_INVALID");
      continue;
    }
    const start = /^ClamAV update process started at (.{24})$/.exec(message);
    if (start) {
      if (active || clamTime(start[1]) !== at) throw new Error("EVIDENCE_INVALID");
      active = true; updated = false; seen.clear(); continue;
    }
    if (message === "--------------------------------------") {
      if (!active || seen.size !== 3) throw new Error("EVIDENCE_INVALID");
      completedAt = at; result = updated ? "UPDATED" : "ALREADY_CURRENT"; active = false; continue;
    }
    if (!active) throw new Error("EVIDENCE_INVALID");
    const row = /^(main|daily|bytecode)\.(cvd|cld) (updated|database is up-to-date) \(version: (\d+), sigs: (\d+), f-level: (\d+), builder: [A-Za-z0-9_.-]+\)$/.exec(message);
    if (row) {
      const version = Number(row[4]);
      if (!Number.isSafeInteger(version) || seen.has(row[1])) throw new Error("EVIDENCE_INVALID");
      if (row[3] === "updated") { validated.set(row[1], version); updated = true; }
      if (validated.get(row[1]) !== version) throw new Error("EVIDENCE_INVALID");
      seen.add(row[1]); continue;
    }
    // Informational download announcements from updatedb(); no success inferred from them.
    if (/^(main|daily|bytecode) database available for download \(remote version: \d+\)$/.test(message)) continue;
    // All other output (warnings, failures, partial incremental paths, unknown formats) rejects.
    throw new Error("EVIDENCE_INVALID");
  }
  if (active || completedAt < 0 || now - completedAt >= 86_400_000
    || disk.length !== 3 || disk.some((d, i) => d.name !== names[i] || validated.get(d.name) !== d.version)) throw new Error("EVIDENCE_INVALID");
  return { completedAt, result };
}
export function diskManifest(components: readonly DiskArtifact[]) {
  return createHash("sha256").update(JSON.stringify(components)).digest("hex");
}
export function parseDaemonVersion(raw: string) {
  const m = /^ClamAV (1\.5\.3)\/(\d+)\/(.{24})\0$/.exec(raw);
  if (!m || !Number.isSafeInteger(Number(m[2]))) throw new Error("EVIDENCE_INVALID");
  return { scanner: "clamav" as const, engineVersion: m[1], dailyVersion: Number(m[2]), dailyPublishedAt: clamTime(m[3]) };
}
