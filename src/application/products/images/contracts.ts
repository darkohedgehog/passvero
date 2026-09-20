import { z } from "zod";
import { ApplicationError } from "../../errors/application-error";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const imageEvidenceSchema = z.object({
  expectedDraftVersionId: z.uuid(), expectedProductUpdatedAt: z.iso.datetime(), expectedDraftUpdatedAt: z.iso.datetime(),
});
export const imageCommandSchema = z.discriminatedUnion("operation", [
  imageEvidenceSchema.extend({ operation: z.literal("SET"), altText: z.string().trim().max(300) }).strict(),
  imageEvidenceSchema.extend({ operation: z.literal("REMOVE") }).strict(),
]);
export type ImageCommand = z.infer<typeof imageCommandSchema>;
export interface NormalizedImage { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png"; sizeBytes: number; checksumSha256: string; width: number; height: number }
export interface ImageAsset extends Omit<NormalizedImage, "bytes"> { id: string; organizationId: string; storageProvider: string; storageBucket: string; storageKey: string }
export interface ImagePresentation { id: string; altText: string | null; width: number; height: number }
export interface ImageState {
  productId: string; updatedAt: string; editable: boolean;
  draft: null | { id: string; updatedAt: string; image: ImagePresentation | null; ambiguous: boolean };
  published: ImagePresentation | null;
}
export interface ImageStorage {
  identity(id: string, mime: NormalizedImage["mimeType"]): Pick<ImageAsset, "storageProvider" | "storageBucket" | "storageKey">;
  put(asset: ImageAsset, bytes: Uint8Array): Promise<void>;
  read(asset: ImageAsset): Promise<Uint8Array>;
  remove(asset: ImageAsset): Promise<void>;
}
export function imageError(category: ApplicationError["category"], code: string) {
  return new ApplicationError(category, code, "The image request could not be completed.", false);
}
