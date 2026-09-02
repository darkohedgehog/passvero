import type { MembershipRole, MembershipStatus } from "@/src/application/context/authenticated-user-context";
import type { CnClassificationEditableField } from "@/src/application/products/cn-classification-current-draft/contracts";
import type { ProductLifecycleStatus, ProductVersionStatus } from "@/src/application/products/list-products/contracts";

export interface CnClassificationProductRecord {
  readonly productId: string;
  readonly organizationId: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentDraftVersionId: string | null;
  readonly updatedAt: Date;
}

export interface CnClassificationVersionRecord {
  readonly productVersionId: string;
  readonly productId: string;
  readonly organizationId: string;
  readonly status: ProductVersionStatus;
  readonly updatedAt: Date;
}

export interface CnClassificationRecord {
  readonly identifierId: string;
  readonly productVersionId: string;
  readonly type: "CN";
  readonly value: string;
  readonly nomenclatureYear: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CnClassificationLoaderRecord extends CnClassificationProductRecord {
  readonly currentDraftVersion: (CnClassificationVersionRecord & {
    readonly cn: CnClassificationRecord | null;
  }) | null;
}

export interface CnClassificationCurrentDraftPersistence<Transaction> {
  findCurrentDraftByProductAndOrganization(input: { readonly productId: string; readonly organizationId: string }): Promise<CnClassificationLoaderRecord | null>;
  readEligibility(transaction: Transaction, input: { readonly organizationId: string; readonly userId: string; readonly membershipId: string }): Promise<{
    readonly organizationStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION";
    readonly membershipStatus: MembershipStatus;
    readonly membershipRole: MembershipRole;
  } | null>;
  readProduct(transaction: Transaction, input: { readonly productId: string; readonly organizationId: string }): Promise<CnClassificationProductRecord | null>;
  readDraftVersion(transaction: Transaction, input: { readonly productVersionId: string; readonly productId: string; readonly organizationId: string }): Promise<CnClassificationVersionRecord | null>;
  readCurrentDraftCn(transaction: Transaction, input: { readonly productVersionId: string; readonly identifierId?: string }): Promise<CnClassificationRecord | null>;
  touchProductIfCurrent(transaction: Transaction, input: { readonly productId: string; readonly organizationId: string; readonly currentDraftVersionId: string; readonly expectedUpdatedAt: Date; readonly actorId: string }): Promise<boolean>;
  touchDraftVersionIfCurrent(transaction: Transaction, input: { readonly productVersionId: string; readonly productId: string; readonly organizationId: string; readonly expectedUpdatedAt: Date; readonly actorId: string }): Promise<boolean>;
  insertCn(transaction: Transaction, input: { readonly productVersionId: string; readonly values: { readonly value: string; readonly nomenclatureYear: number; readonly issuingAuthority: null; readonly notes: null } }): Promise<{ readonly identifierId: string }>;
  updateCnIfCurrent(transaction: Transaction, input: { readonly identifierId: string; readonly productVersionId: string; readonly expectedUpdatedAt: Date; readonly values: { readonly value: string; readonly nomenclatureYear: number; readonly issuingAuthority: null; readonly notes: null } }): Promise<boolean>;
  deleteCnIfCurrent(transaction: Transaction, input: { readonly identifierId: string; readonly productVersionId: string; readonly expectedUpdatedAt: Date }): Promise<boolean>;
  insertProductUpdatedAuditEvent(transaction: Transaction, input: { readonly organizationId: string; readonly actorId: string; readonly productId: string; readonly operation: "ADD" | "EDIT" | "REMOVE"; readonly changedFields?: readonly CnClassificationEditableField[]; readonly correlationId: string }): Promise<void>;
}

export interface CnClassificationCurrentDraftDependencies<Transaction> {
  readonly currentUtcYear: () => number;
  readonly transactionRunner: { run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result> };
  readonly persistence: CnClassificationCurrentDraftPersistence<Transaction>;
}

export class CnClassificationCurrentDraftPersistenceError extends Error {}
export class CnClassificationConflictPersistenceError extends CnClassificationCurrentDraftPersistenceError {}
