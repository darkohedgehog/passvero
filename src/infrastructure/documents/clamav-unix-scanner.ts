import { createHash } from "node:crypto";
import { Socket } from "node:net";
import { isAbsolute } from "node:path";
import type { MalwareScannerPort } from "@/src/application/documents/malware-scan";
import type { NormalizedMalwareEvidence } from "@/src/application/documents/document-security-policy";
import { MAX_DOCUMENT_PDF_SIZE } from "@/src/application/documents/pdf";

const CHUNK_BYTES = 64 * 1024;
const RESPONSE_BYTES = 4096;
/** No runtime composition. Signature names must come from trusted deployment policy, not a request. */
export class ClamavUnixScanner implements MalwareScannerPort {
  private busy = false;
  private readonly malwareSignatures: ReadonlySet<string>;
  constructor(private readonly socketPath: string, malwareSignatures: ReadonlySet<string>) {
    if (!isAbsolute(socketPath) || socketPath.includes("\0")) throw new Error("Invalid scanner configuration");
    this.malwareSignatures = new Set(malwareSignatures);
  }
  async scan(input: Uint8Array, { signal }: { readonly signal: AbortSignal }): Promise<NormalizedMalwareEvidence> {
    if (signal.aborted) return { kind: "INTERRUPTED" };
    if (this.busy) return { kind: "NOT_READY" };
    if (!input.byteLength || input.byteLength > MAX_DOCUMENT_PDF_SIZE) return { kind: "INCOMPLETE" };
    this.busy = true;
    const bytes = Buffer.from(input);
    const identity = { sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    try {
      return await new Promise<NormalizedMalwareEvidence>(resolve => {
        const socket = new Socket();
        let outcome: NormalizedMalwareEvidence | undefined;
        let candidate: NormalizedMalwareEvidence | undefined;
        let connected = false;
        let sent = false;
        let response = Buffer.alloc(0);
        let offset = 0;
        const finish = (result: NormalizedMalwareEvidence) => {
          if (outcome) return;
          outcome = result;
          clearTimeout(connectTimer);
          clearTimeout(overallTimer);
          signal.removeEventListener("abort", abort);
          socket.destroy();
        };
        const abort = () => finish({ kind: "INTERRUPTED" });
        const connectTimer = setTimeout(() => finish({ kind: "TIMEOUT" }), 2000);
        const overallTimer = setTimeout(() => finish({ kind: "TIMEOUT" }), 30_000);
        const writeBody = () => {
          if (outcome || sent) return;
          while (offset < bytes.length) {
            const end = Math.min(offset + CHUNK_BYTES, bytes.length);
            const frame = Buffer.allocUnsafe(4 + end - offset);
            frame.writeUInt32BE(end - offset);
            bytes.copy(frame, 4, offset, end);
            offset = end;
            if (!socket.write(frame)) return;
          }
          sent = true;
          socket.write(Buffer.alloc(4));
        };
        socket.on("drain", writeBody);
        socket.once("connect", () => {
          connected = true;
          clearTimeout(connectTimer);
          if (outcome) return;
          if (socket.write(Buffer.from("zINSTREAM\0"))) writeBody();
        });
        socket.on("data", chunk => {
          if (outcome) return;
          if (response.length + chunk.length > RESPONSE_BYTES) return finish({ kind: "INVALID_RESPONSE" });
          response = Buffer.concat([response, chunk]);
          const end = response.indexOf(0);
          if (end < 0) return;
          if (end !== response.length - 1 || !sent || response.subarray(0, end).some(b => b < 32 || b > 126)) {
            return finish({ kind: "INVALID_RESPONSE" });
          }
          const line = response.subarray(0, end).toString("ascii");
          if (line === "stream: OK") { candidate = { kind: "OK", complete: true, identity }; return; }
          const found = /^stream: ([A-Za-z0-9_.:-]{1,256}) FOUND$/.exec(line)?.[1];
          if (found?.startsWith("Heuristics.") || found?.startsWith("PUA.")) return finish({ kind: "INCOMPLETE" });
          if (found && this.malwareSignatures.has(found)) { candidate = { kind: "MALWARE_DETECTED", complete: true, identity }; return; }
          if (line === "INSTREAM size limit exceeded. ERROR" || line === "stream: INSTREAM size limit exceeded. ERROR") return finish({ kind: "INCOMPLETE" });
          finish({ kind: "INVALID_RESPONSE" });
        });
        socket.once("error", () => finish({ kind: connected ? "INTERRUPTED" : "UNAVAILABLE" }));
        socket.once("end", () => finish(candidate ?? { kind: "INVALID_RESPONSE" }));
        socket.once("close", () => {
          clearTimeout(connectTimer);
          clearTimeout(overallTimer);
          signal.removeEventListener("abort", abort);
          socket.removeAllListeners();
          resolve(outcome ?? { kind: "INTERRUPTED" });
        });
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
        else {
          try { socket.connect(this.socketPath); }
          catch { finish({ kind: "UNAVAILABLE" }); }
        }
      });
    } finally { this.busy = false; }
  }
}
