import { createHash } from "node:crypto";

const names = ["main", "daily", "bytecode"] as const;
export type DatabaseName = typeof names[number];
export interface DiskArtifact { name: DatabaseName; version: number; sha256: string }
/** Explicit supported deployment zones; never the collector host's implicit timezone. */
export type EvidenceTimeZone = "UTC" | "Europe/Zagreb";
export function clamTime(text: string, zone: EvidenceTimeZone = "UTC"): number {
  if (!/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [ \d]\d \d\d:\d\d:\d\d \d{4}$/.test(text)) throw new Error("EVIDENCE_INVALID");
  const date = new Date(`${text} GMT`);
  const canonical = date.toUTCString();
  const expected = `${canonical.slice(0, 3)} ${canonical.slice(8, 11)} ${canonical.slice(5, 7).replace(/^0/, " ")} ${canonical.slice(17, 25)} ${canonical.slice(12, 16)}`;
  if (!Number.isFinite(date.getTime()) || expected !== text) throw new Error("EVIDENCE_INVALID");
  if (zone === "UTC") return date.getTime();
  // Supported modern Zagreb rules have only UTC+1/+2. Round trips reject gaps/folds.
  if (zone !== "Europe/Zagreb" || date.getUTCFullYear() < 2000) throw new Error("EVIDENCE_INVALID");
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const matches = [1, 2].map(hours => date.getTime() - hours * 3600000).filter(at => {
    const parts = Object.fromEntries(formatter.formatToParts(at).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}` === date.toISOString().slice(0, 19);
  });
  if (matches.length !== 1) throw new Error("EVIDENCE_INVALID");
  return matches[0];
}
/** Nonverbose standard-only reviewed 1.5.3/1.5.4 stream, from a retained initialization boundary.
 * Completion is the final bytecode result in the fixed daily/main/bytecode order.
 * This proves logged operations only; protected validation/writer history is a deployment premise.
 */
export function parseFreshclamEvidence(text: string, disk: readonly DiskArtifact[], now: number, zone: EvidenceTimeZone = "UTC") {
  if (Buffer.byteLength(text) > 1_048_576 || !text.endsWith("\n")) throw new Error("EVIDENCE_INVALID");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length > 10_000) throw new Error("EVIDENCE_INVALID");
  const order = ["daily", "main", "bytecode"];
  let previous = -1, index = 0, completedAt = -1;
  let initialized = false, updated = false;
  let announcement: { name: string; version: number } | undefined;
  let result: "UPDATED" | "ALREADY_CURRENT" = "UPDATED";
  const validated = new Map<string, number>();
  for (const line of lines) {
    const split = /^(.{24}) -> (.*)$/.exec(line);
    if (!split) throw new Error("EVIDENCE_INVALID");
    const at = clamTime(split[1], zone), message = split[2];
    if (at < previous || at > now) throw new Error("EVIDENCE_INVALID");
    previous = at;
    if (message === "--------------------------------------") {
      // A restart/rotation cannot silently resolve an interrupted cycle or preserve validation history.
      if (initialized) throw new Error("EVIDENCE_CONTINUITY_REQUIRED");
      initialized = true; continue;
    }
    if (!initialized) throw new Error("EVIDENCE_CONTINUITY_REQUIRED");
    const available = /^(daily|main|bytecode) database available for (?:download \(remote version: (\d+)\)|update \(local version: (\d+), remote version: (\d+)\))$/.exec(message);
    if (available) {
      const version = Number(available[2] ?? available[4]);
      if (available[1] !== order[index] || announcement || !Number.isSafeInteger(version) || version < 1
        || (available[3] !== undefined && (validated.get(available[1]) !== Number(available[3]) || version <= Number(available[3])))) throw new Error("EVIDENCE_INVALID");
      announcement = { name: available[1], version }; continue;
    }
    const row = /^(main|daily|bytecode)\.(cvd|cld) (updated|database is up-to-date) \(version: (\d+), sigs: (\d+), f-level: (\d+), builder: [A-Za-z0-9_.-]+\)$/.exec(message);
    if (!row || row[1] !== order[index]) throw new Error("EVIDENCE_INVALID");
    const version = Number(row[4]);
    if (!Number.isSafeInteger(version) || version < 1) throw new Error("EVIDENCE_INVALID");
    if (row[3] === "updated") {
      if (announcement?.name !== row[1] || announcement.version !== version) throw new Error("EVIDENCE_INVALID");
      validated.set(row[1], version); updated = true;
    } else if (announcement || validated.get(row[1]) !== version) throw new Error("EVIDENCE_CONTINUITY_REQUIRED");
    announcement = undefined;
    if (++index === 3) { completedAt = at; result = updated ? "UPDATED" : "ALREADY_CURRENT"; index = 0; updated = false; }
  }
  if (index || announcement || completedAt < 0 || now - completedAt >= 86_400_000
    || disk.length !== 3 || disk.some((d, i) => d.name !== names[i] || validated.get(d.name) !== d.version)) throw new Error("EVIDENCE_INVALID");
  return { completedAt, result };
}
/** Known listener-start failure is resolved only by a subsequent observed startup/load.
 * A live VERSION is checked separately. Unknown errors never clear on restart or age.
 */
export function validateDaemonEvidence(text: string, now: number, zone: EvidenceTimeZone = "UTC") {
  if (Buffer.byteLength(text) > 1_048_576 || !text.endsWith("\n")) throw new Error("DAEMON_UNCERTAIN");
  let previous = -1, loaded = false, reading = false, restart = false, listenerFailure = false;
  let reloaded = false, completed = false;
  for (const line of text.trimEnd().split("\n")) {
    const match = /^(.{24}) -> (.*)$/.exec(line);
    if (!match) throw new Error("DAEMON_UNCERTAIN");
    const at = clamTime(match[1], zone), message = match[2];
    if (at < previous || at > now) throw new Error("DAEMON_UNCERTAIN"); previous = at;
    if (message === "ERROR: Not listening on any interfaces") { listenerFailure = true; loaded = false; restart = false; continue; }
    // This exact warning describes a refused scan path, not validation/reload failure.
    if (/^WARNING: File path check failure on: .+$/.test(message)) continue;
    if (/ERROR|WARNING|failed|failure/i.test(message)) throw new Error("DAEMON_UNCERTAIN");
    if (/^\+\+\+ Started at /.test(message)) { loaded = false; reading = false; restart = true; reloaded = completed = false; }
    else if (message.startsWith("Reading databases from ") || message === "SelfCheck: Database modification detected. Forcing reload.") { reading = true; reloaded = completed = false; }
    else if (/^Loaded \d+ signatures\.$/.test(message)) {
      if (!reading || !restart) throw new Error("DAEMON_UNCERTAIN");
      loaded = true; reading = false; listenerFailure = false; restart = false;
    } else if (/^Database correctly reloaded \(\d+ signatures\)$/.test(message)) { if (!reading) throw new Error("DAEMON_UNCERTAIN"); reloaded = true; }
    else if (message === "Database reload completed.") { if (!reloaded) throw new Error("DAEMON_UNCERTAIN"); completed = true; }
    else if (message === "Activating the newly loaded database...") { if (!completed) throw new Error("DAEMON_UNCERTAIN"); reading = false; loaded = true; }
    else if (/reload/i.test(message)) throw new Error("DAEMON_UNCERTAIN");
  }
  if (!loaded || reading || listenerFailure) throw new Error("DAEMON_UNCERTAIN");
}
export function diskManifest(components: readonly DiskArtifact[]) {
  return createHash("sha256").update(JSON.stringify(components)).digest("hex");
}
export function parseDaemonVersion(raw: string, zone: EvidenceTimeZone = "UTC") {
  const m = /^ClamAV (1\.5\.[34])\/(\d+)\/(.{24})\0$/.exec(raw);
  if (!m || !Number.isSafeInteger(Number(m[2]))) throw new Error("EVIDENCE_INVALID");
  return { scanner: "clamav" as const, engineVersion: m[1], dailyVersion: Number(m[2]), dailyPublishedAt: clamTime(m[3], zone) };
}
