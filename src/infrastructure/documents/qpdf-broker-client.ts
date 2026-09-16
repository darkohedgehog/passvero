import { createConnection } from "node:net";
import { MAX_DOCUMENT_PDF_SIZE, sha256 } from "../../application/documents/pdf";
import { pdfValidationResultSchema, type PdfValidationPort } from "../../application/documents/pdf-validation";

export const QPDF_BROKER_SOCKET = "/run/passvero-qpdf-broker/validate.sock";

/** Staging-only composition. No paths, options or commands travel to the broker. */
export function createQpdfBrokerPort(socketPath = QPDF_BROKER_SOCKET): PdfValidationPort {
  let busy = false;
  return {
    async validate(input, { signal }) {
      if (busy || signal.aborted) return { kind: "FAILED" };
      if (!(input instanceof Uint8Array) || !input.length || input.length > MAX_DOCUMENT_PDF_SIZE) {
        return { kind: "INVALID", reason: "STRUCTURE" };
      }
      const bytes = Buffer.from(input);
      const identity = { sizeBytes: bytes.length, sha256: sha256(bytes) };
      busy = true;
      try {
        return await new Promise(resolve => {
          const socket = createConnection(socketPath);
          let response = Buffer.alloc(0);
          let cancelled = false;
          let timedOut = false;
          let failed = false;
          let grace: ReturnType<typeof setTimeout> | undefined;
          const cancel = () => {
            if (cancelled) return;
            cancelled = true;
            // A byte after the fixed frame is cancellation, not a new command.
            // Broker acknowledges only after termination/reaping and unlinking.
            socket.write(Buffer.from([0]));
            grace = setTimeout(() => socket.destroy(), 3000);
          };
          const timer = setTimeout(() => { timedOut = true; cancel(); }, 10_000);
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) cancel();
          socket.on("connect", () => {
            if (cancelled) return;
            const header = Buffer.alloc(8);
            header.write("PVQ1");
            header.writeUInt32BE(bytes.length, 4);
            socket.write(header);
            socket.write(bytes);
          });
          socket.on("data", chunk => {
            if (response.length + chunk.length > 1024) { failed = true; cancel(); return; }
            response = Buffer.concat([response, chunk]);
          });
          socket.on("error", () => { failed = true; });
          socket.on("close", () => {
            clearTimeout(timer);
            if (grace) clearTimeout(grace);
            signal.removeEventListener("abort", cancel);
            if (cancelled || failed) return resolve({ kind: timedOut ? "TIMEOUT" : "FAILED" });
            try {
              const parsed = pdfValidationResultSchema.parse(JSON.parse(response.toString("utf8")));
              if (parsed.kind === "VALID" && (parsed.identity.sha256 !== identity.sha256 || parsed.identity.sizeBytes !== identity.sizeBytes)) {
                return resolve({ kind: "FAILED" });
              }
              resolve(parsed);
            } catch { resolve({ kind: "FAILED" }); }
          });
        });
      } finally { busy = false; }
    },
  };
}
