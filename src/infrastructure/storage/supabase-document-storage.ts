import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DocumentError, type PrivateDocumentStorage, type StorageIdentity } from "@/src/application/documents/contracts";
import { readDocumentBytes } from "@/src/application/documents/bytes";
import { MAX_DOCUMENT_PDF_SIZE } from "@/src/application/documents/pdf";

const schema = z.object({
  url: z.string().regex(/^https:\/\/[a-z0-9]{20}\.supabase\.co$/),
  key: z.string().min(30).max(4096),
  bucket: z.string(),
  environment: z.enum(["staging", "production"]),
}).strict();
export function parseDocumentStorageConfig(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DocumentError("OPERATIONAL_FAILURE");
  const config = parsed.data;
  if (config.bucket !== `passvero-${config.environment}-documents`) throw new DocumentError("OPERATIONAL_FAILURE");
  let legacyServiceRole = false;
  try {
    const claims: unknown = JSON.parse(Buffer.from(config.key.split(".")[1] ?? "", "base64url").toString());
    legacyServiceRole = config.key.split(".").length === 3 && z.object({ role: z.literal("service_role") }).safeParse(claims).success;
  } catch { /* Invalid credential shape is rejected below without diagnostics. */ }
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(config.key) && !legacyServiceRole) throw new DocumentError("OPERATIONAL_FAILURE");
  return { ...config, legacyServiceRole };
}
type Config = ReturnType<typeof parseDocumentStorageConfig>;

// Only the server-only runtime composes this adapter with private configuration.
// No Supabase types, URLs or credentials cross the application storage port.
export class SupabaseDocumentStorage implements PrivateDocumentStorage {
  constructor(private readonly config: Config, private readonly transport: typeof fetch = fetch) {}
  identity(): StorageIdentity { return { provider: "supabase", bucket: this.config.bucket, key: `documents/${randomUUID()}.pdf` }; }
  private validate(identity: StorageIdentity) {
    if (identity.provider !== "supabase" || identity.bucket !== this.config.bucket || !/^documents\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/.test(identity.key)) throw new DocumentError("OPERATIONAL_FAILURE");
  }
  private headers(extra?: HeadersInit) {
    const headers = new Headers(extra);
    headers.set("apikey", this.config.key);
    if (this.config.legacyServiceRole) headers.set("authorization", `Bearer ${this.config.key}`);
    return headers;
  }
  private async request(path: string, init: RequestInit = {}) {
    try {
      const response = await this.transport(`${this.config.url}/storage/v1/${path}`, { ...init, headers: this.headers(init.headers), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(60_000) });
      if (!response.ok) { await response.body?.cancel(); throw new DocumentError("OPERATIONAL_FAILURE"); }
      return response;
    } catch { throw new DocumentError("OPERATIONAL_FAILURE"); }
  }
  private async assertPrivateBucket() {
    const response = await this.request(`bucket/${encodeURIComponent(this.config.bucket)}`);
    try {
      const bytes = await readDocumentBytes(response.body, AbortSignal.timeout(10_000), 16384);
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!z.object({ id: z.literal(this.config.bucket), public: z.literal(false) }).safeParse(value).success) throw new Error();
    } catch { throw new DocumentError("OPERATIONAL_FAILURE"); }
  }
  async put(identity: StorageIdentity, bytes: Uint8Array): Promise<void> {
    this.validate(identity);
    if (!bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_PDF_SIZE) throw new DocumentError("VALIDATION_ERROR");
    await this.assertPrivateBucket();
    const response = await this.request(`object/${identity.bucket}/${identity.key}`, { method: "POST", headers: { "content-type": "application/pdf", "x-upsert": "false", "cache-control": "no-store" }, body: new Uint8Array(bytes) });
    await response.body?.cancel();
  }
  async read(identity: StorageIdentity): Promise<Uint8Array> {
    this.validate(identity);
    await this.assertPrivateBucket();
    const response = await this.request(`object/authenticated/${identity.bucket}/${identity.key}`);
    try { return await readDocumentBytes(response.body, AbortSignal.timeout(60_000)); }
    catch { throw new DocumentError("OPERATIONAL_FAILURE"); }
  }
}
