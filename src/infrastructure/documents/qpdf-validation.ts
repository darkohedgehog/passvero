import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { MAX_DOCUMENT_PDF_SIZE, sha256 } from "../../application/documents/pdf";
import type { PdfValidationPort, PdfValidationResult } from "../../application/documents/pdf-validation";

const DEADLINE_MS = 10_000;
const OUTPUT_LIMIT = 64 * 1024;
const TERMINATION_GRACE_MS = 250;
type StopReason = "ABORT" | "TIMEOUT" | "OUTPUT";
type ProcessResult = { code: number | null; signal: NodeJS.Signals | null; failed: boolean; stderr: boolean };

/** Trusted composition configuration only; never obtain either path from a document/request. */
export function createQpdfValidationPort(config: Readonly<{
  executablePath: string;
  temporaryRoot?: string;
}>): PdfValidationPort {
  let busy = false;
  return {
    async validate(input, { signal }): Promise<PdfValidationResult> {
      if (busy || signal.aborted) return { kind: "FAILED" };
      if (!(input instanceof Uint8Array) || input.byteLength === 0 || input.byteLength > MAX_DOCUMENT_PDF_SIZE) {
        return { kind: "INVALID", reason: "STRUCTURE" };
      }
      if (!isAbsolute(config.executablePath) || (process.platform !== "darwin" && process.platform !== "linux")) {
        return { kind: "FAILED" };
      }
      let directory: string | undefined;
      let child: ChildProcess | undefined;
      let escalation: ReturnType<typeof setTimeout> | undefined;
      let stopped: StopReason | undefined;
      let outputBytes = 0;
      let result: PdfValidationResult = { kind: "FAILED" };
      const end = performance.now() + DEADLINE_MS;
      // Snapshot before the first await: callers cannot change bytes during path/file I/O.
      const bytes = new Uint8Array(input);
      const identity = { sizeBytes: bytes.byteLength, sha256: sha256(bytes) };
      busy = true;
      function kill(groupSignal: NodeJS.Signals) {
        if (!child?.pid) return;
        try { process.kill(-child.pid, groupSignal); }
        catch { child.kill(groupSignal); }
      }
      function stop(reason: StopReason) {
        if (stopped) return;
        stopped = reason;
        if (child) {
          kill("SIGTERM");
          escalation = setTimeout(() => kill("SIGKILL"), TERMINATION_GRACE_MS);
        }
      }
      const onAbort = () => stop("ABORT");
      const timer = setTimeout(() => stop("TIMEOUT"), Math.max(0, end - performance.now()));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) stop("ABORT");
      function expired(): boolean {
        if (performance.now() >= end) stop("TIMEOUT");
        return stopped !== undefined;
      }
      async function inspect(executable: string, args: string[]): Promise<ProcessResult> {
        if (expired()) return { code: null, signal: null, failed: true, stderr: false };
        return new Promise(resolve => {
          let failed = false;
          let stderr = false;
          const processChild = spawn(executable, args, {
            shell: false, detached: true, cwd: directory,
            env: { LANG: "C", LC_ALL: "C", NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"],
          });
          child = processChild;
          const count = (chunk: Buffer) => {
            outputBytes += chunk.byteLength;
            if (outputBytes > OUTPUT_LIMIT) stop("OUTPUT");
          };
          processChild.stdout?.on("data", count);
          processChild.stderr?.on("data", (chunk: Buffer) => { stderr ||= chunk.byteLength > 0; count(chunk); });
          processChild.on("error", () => { failed = true; });
          // close follows exit and closed stdio: never resolve on timeout/abort before reaping.
          processChild.on("close", (code, processSignal) => {
            if (escalation) clearTimeout(escalation);
            child = undefined;
            resolve({ code, signal: processSignal, failed, stderr });
          });
        });
      }
      try {
        const executable = await realpath(config.executablePath);
        await access(executable, constants.X_OK);
        if (!expired()) {
          directory = await mkdtemp(join(config.temporaryRoot ?? tmpdir(), "passvero-qpdf-"));
          const filename = join(directory, "input.pdf");
          await writeFile(filename, bytes, { mode: 0o600, flag: "wx" });
          const encryption = await inspect(executable, ["--is-encrypted", filename]);
          if (!expired() && !encryption.failed && !encryption.signal) {
            if (encryption.code === 0 && !encryption.stderr) result = { kind: "ENCRYPTED" };
            else if (encryption.code === 2) {
              const check = await inspect(executable, ["--check", "--suppress-recovery", filename]);
              if (!expired() && !check.failed && !check.signal) {
                if (check.code === 3) result = { kind: "INVALID", reason: "WARNING" };
                else if (check.code === 2) result = { kind: "INVALID", reason: "STRUCTURE" };
                else if (check.code === 0 && !check.stderr && !encryption.stderr) result = { kind: "VALID", identity };
              }
            }
          }
        }
      } catch {
        result = { kind: "FAILED" };
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        if (stopped) result = { kind: stopped === "TIMEOUT" ? "TIMEOUT" : "FAILED" };
        try { if (directory) await rm(directory, { recursive: true, force: true }); }
        catch { result = { kind: "FAILED" }; }
        busy = false;
      }
      return result;
    },
  };
}
