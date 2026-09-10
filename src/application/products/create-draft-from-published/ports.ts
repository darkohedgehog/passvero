import type { PublicationVersionRecord, PublishProductPersistence } from "@/src/application/products/publish-product/ports";

export class DraftCreationConflict extends Error {}
export interface CreateDraftFromPublishedPersistence<T> extends Pick<PublishProductPersistence<T>, "readEligibility" | "readProductForPublication"> {
  readVersion(transaction: T, input: { productVersionId: string; productId: string; organizationId: string }): Promise<(PublicationVersionRecord & { clonedFromVersionId: string | null }) | null>;
  readCopyEligibility(transaction: T, input: { productVersionId: string; organizationId: string; sourceLocale: string }): Promise<{ imageCount: number; sourceTranslationValid: boolean; documentOwnershipValid: boolean }>;
  createDraft(transaction: T, input: {
    productId: string; organizationId: string; sourceVersionId: string; sourceLocale: string;
    expectedProductUpdatedAt: Date; actorId: string; correlationId: string;
  }): Promise<void>;
}
export interface CreateDraftFromPublishedDependencies<T> {
  readonly transactionRunner: { run<R>(work: (transaction: T) => Promise<R>): Promise<R> };
  readonly persistence: CreateDraftFromPublishedPersistence<T>;
}
