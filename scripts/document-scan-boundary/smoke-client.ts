import { createConnection, Socket } from "node:net";
import { channel } from "node:diagnostics_channel";
import { createQpdfBrokerPort, QPDF_BROKER_SOCKET } from "../../src/infrastructure/documents/qpdf-broker-client";
import { pdfValidationResultSchema, type PdfValidationResult } from "../../src/application/documents/pdf-validation";

export type Outcome = "VALID" | "REJECTED_REQUEST" | "CONNECTION_FAILURE" | "TIMEOUT" |
  "MALFORMED_RESPONSE" | "INCOMPLETE_RESPONSE" | "UNEXPECTED_VALID_RESPONSE" |
  "IDENTITY_FAILURE" | "INTERNAL_HARNESS_ERROR";
type ClientKind = PdfValidationResult["kind"] | "UNAVAILABLE";
type Observation = Outcome | { outcome: Outcome; kind: ClientKind };
export interface ClientCheck {
  client_kind: ClientKind;
  CHECK_ID: "CLIENT_VALID_PDF" | "CLIENT_FORBIDDEN_OPERATION";
  phase: "CLIENT";
  expected: "VALID" | "REJECTED_REQUEST";
  actual: Outcome | "UNAVAILABLE";
  duration_ms: number;
  exit_code: "UNAVAILABLE";
  signal: "UNAVAILABLE";
  result: "PASS" | "FAIL" | "NOT_RUN";
}

// Passive observation of this CLI's existing connection; no extra request or timeout.
export function responseObserver() {
  let response = Buffer.alloc(0);
  let overflow = false;
  let connectionError = false;
  return {
    attach(socket: Socket) {
      socket.on("error", () => { connectionError = true; });
      socket.on("data", (chunk: Buffer) => {
        if (response.length + chunk.length > 1024) { overflow = true; return; }
        response = Buffer.concat([response, chunk]);
      });
    },
    classify(kind: string): Outcome {
      if (kind === "TIMEOUT") return "TIMEOUT";
      if (connectionError) return "CONNECTION_FAILURE";
      if (overflow) return "MALFORMED_RESPONSE";
      if (!response.length) return "INCOMPLETE_RESPONSE";
      try {
        const parsed = pdfValidationResultSchema.parse(JSON.parse(response.toString("utf8")));
        if (parsed.kind === "VALID") return kind === "VALID" ? "VALID" : "IDENTITY_FAILURE";
        if (parsed.kind === "FAILED") return "REJECTED_REQUEST";
        return "UNEXPECTED_VALID_RESPONSE";
      } catch { return "MALFORMED_RESPONSE"; }
    },
  };
}
function fixture() {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
  let text = "%PDF-1.4\n"; const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(text)); text += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(text);
  text += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text);
}

async function validate(): Promise<Observation> {
  const observer = responseObserver();
  const events = channel("net.client.socket");
  const listener = (message: unknown) => {
    if (typeof message === "object" && message !== null && "socket" in message && message.socket instanceof Socket) {
      observer.attach(message.socket);
    }
  };
  events.subscribe(listener);
  try {
    const result = await createQpdfBrokerPort().validate(fixture(), { signal: AbortSignal.timeout(13_000) });
    return { outcome: observer.classify(result.kind), kind: result.kind };
  } finally { events.unsubscribe(listener); }
}

async function forbidden(): Promise<Outcome> {
  return new Promise(resolve => {
    const socket = createConnection(QPDF_BROKER_SOCKET);
    let output = ""; let timeout = false; let failed = false;
    socket.setTimeout(2000, () => { timeout = true; socket.destroy(); });
    socket.on("connect", () => socket.write("SHELLxxx"));
    socket.on("data", (chunk: Buffer) => {
      if (output.length < 1024) output += chunk.toString();
    });
    socket.on("error", () => { failed = true; });
    socket.on("close", () => {
      if (timeout) return resolve("TIMEOUT");
      if (failed) return resolve("CONNECTION_FAILURE");
      if (!output.length) return resolve("INCOMPLETE_RESPONSE");
      // Preserve the original exact serialized rejection criterion.
      if (output.toString().trim() === '{"kind":"FAILED"}') return resolve("REJECTED_REQUEST");
      try {
        pdfValidationResultSchema.parse(JSON.parse(output.toString()));
        resolve("UNEXPECTED_VALID_RESPONSE");
      } catch { resolve("MALFORMED_RESPONSE"); }
    });
  });
}

export async function runClient(operations: { validate: () => Promise<Observation>; forbidden: () => Promise<Observation> } = { validate, forbidden }): Promise<ClientCheck[]> {
  const rows: ClientCheck[] = [
    { client_kind: "UNAVAILABLE", CHECK_ID: "CLIENT_VALID_PDF", phase: "CLIENT", expected: "VALID", actual: "UNAVAILABLE", duration_ms: 0, exit_code: "UNAVAILABLE", signal: "UNAVAILABLE", result: "NOT_RUN" },
    { client_kind: "UNAVAILABLE", CHECK_ID: "CLIENT_FORBIDDEN_OPERATION", phase: "CLIENT", expected: "REJECTED_REQUEST", actual: "UNAVAILABLE", duration_ms: 0, exit_code: "UNAVAILABLE", signal: "UNAVAILABLE", result: "NOT_RUN" },
  ];
  for (const [index, operation] of [operations.validate, operations.forbidden].entries()) {
    const row = rows[index]; const start = performance.now();
    try {
      const observed = await operation();
      row.actual = typeof observed === "string" ? observed : observed.outcome;
      row.client_kind = typeof observed === "string" ? "UNAVAILABLE" : observed.kind;
    } catch { row.actual = "INTERNAL_HARNESS_ERROR"; }
    row.duration_ms = Math.min(60_000, Math.max(0, Math.round(performance.now() - start)));
    row.result = row.actual === row.expected ? "PASS" : "FAIL";
    if (row.result === "FAIL") break;
  }
  return rows;
}

if (/[/\\]smoke-client\.(?:ts|cjs)$/.test(process.argv[1] ?? "")) {
  void runClient().then(checks => {
    console.log(JSON.stringify({ checks }));
    if (checks.some(row => row.result !== "PASS")) process.exitCode = 1;
  });
}
