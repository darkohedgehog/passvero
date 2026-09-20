import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import { ApplicationError } from "../../errors/application-error";
import { hasProductPermission } from "../../permissions/product-permissions";
import { imageCommandSchema, imageError, type ImageAsset, type ImageStorage, type NormalizedImage } from "./contracts";
import type { ImagePersistence } from "./ports";
export function createImageServices(deps: { persistence: ImagePersistence; storage: ImageStorage; normalize(bytes: Uint8Array): Promise<NormalizedImage> }) {
  function context(value: AuthenticatedUserContext | null, edit: boolean): asserts value is AuthenticatedUserContext {
    if (!value || value.membershipStatus !== "ACTIVE" || !hasProductPermission(value, edit ? "PRODUCT_EDIT" : "PRODUCT_READ")) throw imageError("FORBIDDEN", "FORBIDDEN");
  }
  function uuid(id: string) { if (!z.uuid().safeParse(id).success) throw imageError("VALIDATION", "VALIDATION_ERROR"); }
  async function safe<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) { if (error instanceof ApplicationError) throw error; throw imageError("INTERNAL", "OPERATIONAL_FAILURE"); }
  }
  return {
    get: (id: string, ctx: AuthenticatedUserContext | null) => safe(async () => { context(ctx, false); uuid(id); return deps.persistence.get(id, ctx); }),
    authorize: (id: string, input: unknown, ctx: AuthenticatedUserContext | null) => safe(async () => {
      context(ctx, true); uuid(id); const command = imageCommandSchema.safeParse(input);
      if (!command.success) throw imageError("VALIDATION", "VALIDATION_ERROR");
      await deps.persistence.check(id, command.data, ctx);
    }),
    mutate: (id: string, input: unknown, bytes: Uint8Array | null, ctx: AuthenticatedUserContext | null) => safe(async () => {
      context(ctx, true); uuid(id); const parsed = imageCommandSchema.safeParse(input);
      if (!parsed.success) throw imageError("VALIDATION", "VALIDATION_ERROR");
      const command = parsed.data;
      await deps.persistence.check(id, command, ctx);
      if (command.operation === "REMOVE") { await deps.persistence.finalize(id, command, ctx); return { status: "UPDATED" as const }; }
      if (!bytes) throw imageError("VALIDATION", "INVALID_IMAGE");
      const { bytes: normalizedBytes, ...metadata } = await deps.normalize(bytes);
      const assetId = randomUUID();
      const asset: ImageAsset = { ...metadata, id: assetId, organizationId: ctx.organizationId, ...deps.storage.identity(assetId, metadata.mimeType) };
      await deps.persistence.reserve(id, command, ctx, asset);
      try {
        await deps.storage.put(asset, normalizedBytes);
        // Verify the persisted object before its first reference becomes visible.
        const stored = await deps.storage.read(asset);
        if (stored.length !== asset.sizeBytes || createHash("sha256").update(stored).digest("hex") !== asset.checksumSha256) throw imageError("INTERNAL", "UPLOAD_FAILED");
        await deps.persistence.finalize(id, command, ctx, assetId);
      } catch (error) {
        // A commit with an uncertain response might already have succeeded.
        // Only a locked PENDING->ABANDONED transition authorizes exact-key cleanup.
        try { if (await deps.persistence.abandon(assetId, ctx.organizationId)) await deps.storage.remove(asset); }
        catch { /* Durable PENDING/ABANDONED row retains the exact orphan identity for operator recovery. */ }
        throw error;
      }
      return { status: "UPDATED" as const };
    }),
    download: (target: { publicCode: string } | { productId: string; context: AuthenticatedUserContext | null }, imageId: string) => safe(async () => {
      uuid(imageId);
      const load = async () => {
        if ("publicCode" in target) {
          if (!/^[A-Za-z0-9_-]{16,64}$/.test(target.publicCode)) throw imageError("NOT_FOUND", "NOT_FOUND");
          return deps.persistence.publicAsset(target.publicCode, imageId);
        }
        context(target.context, false); uuid(target.productId);
        return deps.persistence.privateAsset(target.productId, imageId, target.context);
      };
      const asset = await load(); const bytes = await deps.storage.read(asset);
      if (bytes.length !== asset.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== asset.checksumSha256) throw imageError("INTERNAL", "OPERATIONAL_FAILURE");
      const current = await load(); // Recheck visibility/authority after storage I/O.
      if (current.id !== asset.id || current.checksumSha256 !== asset.checksumSha256) throw imageError("NOT_FOUND", "NOT_FOUND");
      return { bytes, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes };
    }),
  };
}
