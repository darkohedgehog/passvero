import { DocumentError } from "./contracts";
import { MAX_DOCUMENT_PDF_SIZE } from "./pdf";
// A byte cap is enforced while reading, including chunked requests without Content-Length.
export async function readDocumentBytes(stream: ReadableStream<Uint8Array> | null, signal?: AbortSignal, limit = MAX_DOCUMENT_PDF_SIZE): Promise<Uint8Array> {
  if (!stream) throw new DocumentError("VALIDATION_ERROR");
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) { await reader.cancel(); throw new DocumentError("OPERATIONAL_FAILURE"); }
    while (true) {
      const chunk = await reader.read();
      if (signal?.aborted) throw new DocumentError("OPERATIONAL_FAILURE");
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) { await reader.cancel(); throw new DocumentError("VALIDATION_ERROR"); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { signal?.removeEventListener("abort", abort); reader.releaseLock(); }
}
