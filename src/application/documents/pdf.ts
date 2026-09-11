import { createHash } from "node:crypto";
import { z } from "zod";
import { DocumentError, type UploadDocumentInput } from "./contracts";
export const MAX_DOCUMENT_PDF_SIZE = 10 * 1024 * 1024;
const controls = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const metadata = z.object({filename:z.string().min(1).max(4096),mimeType:z.literal("application/pdf"),displayName:z.string().max(200).optional()}).strict();
export function validatePdf(input: UploadDocumentInput) {
  const parsed=metadata.safeParse({filename:input.filename,mimeType:input.mimeType,displayName:input.displayName});
  if (!parsed.success || controls.test(parsed.data.filename) || (parsed.data.displayName && controls.test(parsed.data.displayName))) throw new DocumentError("VALIDATION_ERROR");
  const originalFilename=parsed.data.filename.replaceAll("\\","/").split("/").at(-1)!.normalize("NFC").trim();
  if (!originalFilename || Array.from(originalFilename).length>200 || !/\.pdf$/i.test(originalFilename)) throw new DocumentError("VALIDATION_ERROR");
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength===0 || input.bytes.byteLength>MAX_DOCUMENT_PDF_SIZE || ![0x25,0x50,0x44,0x46,0x2d].every((byte,index)=>input.bytes[index]===byte)) throw new DocumentError("VALIDATION_ERROR");
  return {originalFilename,displayName:parsed.data.displayName?.normalize("NFC").trim() || null,sizeBytes:input.bytes.byteLength,checksumSha256:sha256(input.bytes)};
}
export function sha256(bytes:Uint8Array) {return createHash("sha256").update(bytes).digest("hex");}
export function documentId(value:unknown):string {const result=z.uuid().safeParse(value);if(!result.success)throw new DocumentError("VALIDATION_ERROR");return result.data;}
