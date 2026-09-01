import type { MembershipRole, MembershipStatus } from "@/src/application/context/authenticated-user-context";
import type { ProductLifecycleStatus, ProductVersionStatus } from "@/src/application/products/list-products/contracts";
import type { DraftTranslationContentField, DraftTranslationContentValues } from "@/src/application/products/draft-translation-content/contracts";

export interface DraftTranslationContentProductRecord {
  readonly productId: string; readonly organizationId: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentDraftVersionId: string | null; readonly updatedAt: Date;
}
export interface DraftTranslationContentVersionRecord {
  readonly productVersionId: string; readonly productId: string; readonly organizationId: string;
  readonly status: ProductVersionStatus; readonly sourceLocale: string; readonly updatedAt: Date;
}
export interface DraftTranslationContentRecord extends DraftTranslationContentValues {
  readonly productVersionId: string; readonly locale: string; readonly updatedAt: Date;
}
export interface DraftTranslationContentLoaderRecord extends DraftTranslationContentProductRecord {
  readonly currentDraftVersion: (DraftTranslationContentVersionRecord & {
    readonly sourceTranslation: DraftTranslationContentRecord | null;
  }) | null;
}
export interface GetDraftTranslationContentPersistence {
  findByIdAndOrganization(input: { readonly productId: string; readonly organizationId: string }): Promise<DraftTranslationContentLoaderRecord | null>;
}
export interface DraftTranslationContentPersistence<Transaction> {
  readEligibility(transaction: Transaction, input: { readonly organizationId: string; readonly userId: string; readonly membershipId: string }): Promise<{ readonly organizationStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION"; readonly membershipStatus: MembershipStatus; readonly membershipRole: MembershipRole } | null>;
  readProduct(transaction: Transaction, input: { readonly productId: string; readonly organizationId: string }): Promise<DraftTranslationContentProductRecord | null>;
  readDraftVersion(transaction: Transaction, input: { readonly productVersionId: string; readonly productId: string; readonly organizationId: string }): Promise<DraftTranslationContentVersionRecord | null>;
  readSourceTranslation(transaction: Transaction, input: { readonly productVersionId: string; readonly locale: string }): Promise<DraftTranslationContentRecord | null>;
  touchProductIfCurrent(transaction: Transaction, input: { readonly productId: string; readonly organizationId: string; readonly currentDraftVersionId: string; readonly expectedUpdatedAt: Date; readonly actorId: string }): Promise<boolean>;
  touchDraftVersionIfCurrent(transaction: Transaction, input: { readonly productVersionId: string; readonly productId: string; readonly organizationId: string; readonly expectedUpdatedAt: Date; readonly actorId: string }): Promise<boolean>;
  updateSourceTranslationIfCurrent(transaction: Transaction, input: { readonly productVersionId: string; readonly locale: string; readonly expectedUpdatedAt: Date; readonly values: DraftTranslationContentValues }): Promise<boolean>;
  insertProductUpdatedAuditEvent(transaction: Transaction, input: { readonly organizationId: string; readonly actorId: string; readonly productId: string; readonly changedFields: readonly DraftTranslationContentField[]; readonly correlationId: string }): Promise<void>;
}
export interface DraftTranslationContentDependencies<Transaction> {
  readonly transactionRunner: { run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result> };
  readonly persistence: DraftTranslationContentPersistence<Transaction>;
}
export class DraftTranslationContentPersistenceError extends Error {}
