import type {
  MembershipRole,
  MembershipStatus,
} from "@/src/application/context/authenticated-user-context";
import type {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from "@/src/application/products/list-products/contracts";

export interface ProductDraftEditSourceTranslationRecord {
  readonly productVersionId: string;
  readonly locale: string;
  readonly productName: string;
  readonly updatedAt: Date;
}

export interface ProductDraftEditVersionRecord {
  readonly productVersionId: string;
  readonly productId: string;
  readonly organizationId: string;
  readonly status: ProductVersionStatus;
  readonly sourceLocale: string;
  readonly updatedAt: Date;
  readonly sourceTranslation: ProductDraftEditSourceTranslationRecord | null;
}

export interface ProductDraftEditRecord {
  readonly productId: string;
  readonly organizationId: string;
  readonly internalName: string;
  readonly sku: string | null;
  readonly normalizedSku: string | null;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentDraftVersionId: string | null;
  readonly updatedAt: Date;
  readonly currentDraftVersion: ProductDraftEditVersionRecord | null;
}

export interface GetProductDraftForEditPersistence {
  findByIdAndOrganization(input: {
    readonly productId: string;
    readonly organizationId: string;
  }): Promise<ProductDraftEditRecord | null>;
}

export interface ProductEditEligibility {
  readonly organizationStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION";
  readonly membershipStatus: MembershipStatus;
  readonly membershipRole: MembershipRole;
}

export type EditProductDraftPersistenceErrorKind =
  | "ORGANIZATION_SKU_CONFLICT"
  | "UNKNOWN";

export class EditProductDraftPersistenceError extends Error {
  constructor(readonly kind: EditProductDraftPersistenceErrorKind) {
    super(kind);
  }
}

export interface EditProductDraftTransactionRunner<Transaction> {
  run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

export interface EditProductDraftPersistence<Transaction> {
  readEligibility(transaction: Transaction, input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly membershipId: string;
  }): Promise<ProductEditEligibility | null>;
  readProduct(transaction: Transaction, input: {
    readonly productId: string;
    readonly organizationId: string;
  }): Promise<Omit<ProductDraftEditRecord, "currentDraftVersion"> | null>;
  readDraftVersion(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly productId: string;
    readonly organizationId: string;
  }): Promise<Omit<ProductDraftEditVersionRecord, "sourceTranslation"> | null>;
  readSourceTranslation(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly locale: string;
  }): Promise<ProductDraftEditSourceTranslationRecord | null>;
  updateProductIfCurrent(transaction: Transaction, input: {
    readonly productId: string;
    readonly organizationId: string;
    readonly currentDraftVersionId: string;
    readonly expectedUpdatedAt: Date;
    readonly internalName: string;
    readonly sku: string | null;
    readonly normalizedSku: string | null;
    readonly actorId: string;
  }): Promise<boolean>;
  touchDraftVersionIfCurrent(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly productId: string;
    readonly organizationId: string;
    readonly expectedUpdatedAt: Date;
    readonly actorId: string;
  }): Promise<boolean>;
  updateSourceTranslationIfCurrent(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly locale: string;
    readonly expectedUpdatedAt: Date;
    readonly productName: string;
  }): Promise<boolean>;
  insertProductUpdatedAuditEvent(transaction: Transaction, input: {
    readonly organizationId: string;
    readonly actorId: string;
    readonly productId: string;
    readonly changedFields: readonly ("productName" | "organizationSku")[];
    readonly correlationId: string;
  }): Promise<void>;
}

export interface EditProductDraftDependencies<Transaction> {
  readonly transactionRunner: EditProductDraftTransactionRunner<Transaction>;
  readonly persistence: EditProductDraftPersistence<Transaction>;
}
