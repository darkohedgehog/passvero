import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import type { ProductPermission } from "../permissions/product-permissions";
export type DocumentFailure = "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "NOT_AVAILABLE" | "UPLOAD_FAILED" | "RECOVERY_REQUIRED" | "OPERATIONAL_FAILURE";
export class DocumentError extends Error {
  constructor(readonly code: DocumentFailure) { super(code); this.name = "DocumentError"; }
}
export interface StorageIdentity { readonly provider: string; readonly bucket: string; readonly key: string }
export interface PrivateDocumentStorage {
  identity(): StorageIdentity;
  put(identity: StorageIdentity, bytes: Uint8Array): Promise<void>;
  /** Enforce the byte cap during consumption, and cancel the source on abort/overflow. */
  read(identity: StorageIdentity, options?: { readonly signal: AbortSignal; readonly limit: number }): Promise<Uint8Array>;
}
export interface DocumentRecord {
  readonly scan?: import("./access-policy").DocumentScanState;
  readonly id: string;
  readonly originalFilename: string;
  readonly displayName: string | null;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly storage: StorageIdentity;
  readonly status: "PENDING_UPLOAD" | "AVAILABLE" | "FAILED" | "ARCHIVED";
}
export interface DocumentPersistence {
  authorize(context: AuthenticatedUserContext, permission: ProductPermission): Promise<void>;
  createPending(context: AuthenticatedUserContext, data: Omit<DocumentRecord, "id" | "status">): Promise<DocumentRecord>;
  read(context: AuthenticatedUserContext, id: string, permission: ProductPermission): Promise<DocumentRecord>;
  finalize(context: AuthenticatedUserContext, id: string): Promise<void>;
  fail(context: AuthenticatedUserContext, id: string): Promise<void>;
}
export interface UploadDocumentInput { readonly filename: unknown; readonly mimeType: unknown; readonly displayName?: unknown; readonly bytes: Uint8Array }
export interface DocumentServices {
  authorizeUpload(context: AuthenticatedUserContext): Promise<void>;
  upload(input: UploadDocumentInput, context: AuthenticatedUserContext): Promise<{status:"AVAILABLE"; documentId:string}>;
  recoverPending(id: string, context: AuthenticatedUserContext): Promise<{status:"AVAILABLE"; documentId:string}>;
  download(id: string, context: AuthenticatedUserContext, head?: boolean, options?: { readonly signal: AbortSignal }): Promise<{filename:string; sizeBytes:number; bytes:Uint8Array | null}>;
}
