import { parseDocumentStorageConfig } from "./supabase-document-storage";
import { readDocumentBytes } from "@/src/application/documents/bytes";
import { imageError, MAX_IMAGE_BYTES, type ImageAsset, type ImageStorage, type NormalizedImage } from "@/src/application/products/images/contracts";
import { z } from "zod";
// Reuse credential validation, without broadening the PDF adapter's identity/MIME contract.
export class SupabaseImageStorage implements ImageStorage {
  private readonly config: ReturnType<typeof parseDocumentStorageConfig>;
  private readonly bucket: string;
  constructor(input: unknown, private readonly transport: typeof fetch = fetch) {
    this.config = parseDocumentStorageConfig(input);
    this.bucket = `passvero-${this.config.environment}-images`;
  }
  identity(id: string, mime: NormalizedImage["mimeType"]) { return { storageProvider: "supabase", storageBucket: this.bucket, storageKey: `images/${id}.${mime === "image/png" ? "png" : "jpg"}` }; }
  private validate(asset: ImageAsset) {
    if (asset.storageProvider !== "supabase" || asset.storageBucket !== this.bucket || !/^images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg)$/.test(asset.storageKey)) throw imageError("INTERNAL", "OPERATIONAL_FAILURE");
  }
  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers); headers.set("apikey", this.config.key);
    if (this.config.legacyServiceRole) headers.set("authorization", `Bearer ${this.config.key}`);
    const response = await this.transport(`${this.config.url}/storage/v1/${path}`, { ...init, headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) { await response.body?.cancel(); throw imageError("INTERNAL", "OPERATIONAL_FAILURE"); }
    return response;
  }
  private async privateBucket() {
    const response = await this.request(`bucket/${this.bucket}`);
    const bytes = await readDocumentBytes(response.body, AbortSignal.timeout(10_000), 16384);
    if (!z.object({ id: z.literal(this.bucket), public: z.literal(false) }).safeParse(JSON.parse(Buffer.from(bytes).toString())).success) throw imageError("INTERNAL", "OPERATIONAL_FAILURE");
  }
  async put(asset: ImageAsset, bytes: Uint8Array) {
    this.validate(asset); if (bytes.length !== asset.sizeBytes || bytes.length > MAX_IMAGE_BYTES) throw imageError("VALIDATION", "INVALID_IMAGE");
    await this.privateBucket();
    const response = await this.request(`object/${this.bucket}/${asset.storageKey}`, { method: "POST", headers: { "content-type": asset.mimeType, "x-upsert": "false", "cache-control": "no-store" }, body: new Uint8Array(bytes) });
    await response.body?.cancel();
  }
  async read(asset: ImageAsset) {
    this.validate(asset); await this.privateBucket();
    const response = await this.request(`object/authenticated/${this.bucket}/${asset.storageKey}`);
    return readDocumentBytes(response.body, AbortSignal.timeout(20_000), Math.min(asset.sizeBytes, MAX_IMAGE_BYTES));
  }
  async remove(asset: ImageAsset) {
    this.validate(asset); await this.privateBucket();
    const response = await this.request(`object/${this.bucket}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefixes: [asset.storageKey] }) });
    await response.body?.cancel();
  }
}
