import type {
  MembershipRole,
  MembershipStatus,
} from "@/src/application/context/authenticated-user-context";
import type {
  ProductMaterialEditableField,
  ProductMaterialValues,
} from "@/src/application/products/product-materials-current-draft/contracts";
import type {
  ProductLifecycleStatus,
  ProductVersionStatus,
} from "@/src/application/products/list-products/contracts";

export interface ProductMaterialsProductRecord {
  readonly productId: string;
  readonly organizationId: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentDraftVersionId: string | null;
  readonly updatedAt: Date;
}

export interface ProductMaterialsVersionRecord {
  readonly productVersionId: string;
  readonly productId: string;
  readonly organizationId: string;
  readonly status: ProductVersionStatus;
  readonly updatedAt: Date;
}

export interface ProductMaterialRecord extends ProductMaterialValues {
  readonly materialId: string;
  readonly productVersionId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductMaterialsLoaderRecord extends ProductMaterialsProductRecord {
  readonly currentDraftVersion: (ProductMaterialsVersionRecord & {
    readonly materials: readonly ProductMaterialRecord[];
  }) | null;
}

export interface ProductMaterialsCurrentDraftPersistence<Transaction> {
  findCurrentDraftByProductAndOrganization(input: {
    readonly productId: string;
    readonly organizationId: string;
  }): Promise<ProductMaterialsLoaderRecord | null>;
  readEligibility(transaction: Transaction, input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly membershipId: string;
  }): Promise<{
    readonly organizationStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION";
    readonly membershipStatus: MembershipStatus;
    readonly membershipRole: MembershipRole;
  } | null>;
  readProduct(transaction: Transaction, input: {
    readonly productId: string;
    readonly organizationId: string;
  }): Promise<ProductMaterialsProductRecord | null>;
  readDraftVersion(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly productId: string;
    readonly organizationId: string;
  }): Promise<ProductMaterialsVersionRecord | null>;
  readMaterial(transaction: Transaction, input: {
    readonly materialId: string;
    readonly productVersionId: string;
  }): Promise<ProductMaterialRecord | null>;
  readMaterials(transaction: Transaction, input: {
    readonly productVersionId: string;
  }): Promise<readonly ProductMaterialRecord[]>;
  touchProductIfCurrent(transaction: Transaction, input: {
    readonly productId: string;
    readonly organizationId: string;
    readonly currentDraftVersionId: string;
    readonly expectedUpdatedAt: Date;
    readonly actorId: string;
  }): Promise<boolean>;
  touchDraftVersionIfCurrent(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly productId: string;
    readonly organizationId: string;
    readonly expectedUpdatedAt: Date;
    readonly actorId: string;
  }): Promise<boolean>;
  insertMaterial(transaction: Transaction, input: {
    readonly productVersionId: string;
    readonly values: ProductMaterialValues;
  }): Promise<{ readonly materialId: string }>;
  updateMaterialIfCurrent(transaction: Transaction, input: {
    readonly materialId: string;
    readonly productVersionId: string;
    readonly expectedUpdatedAt: Date;
    readonly values: ProductMaterialValues;
  }): Promise<boolean>;
  deleteMaterialIfCurrent(transaction: Transaction, input: {
    readonly materialId: string;
    readonly productVersionId: string;
    readonly expectedUpdatedAt: Date;
  }): Promise<boolean>;
  insertProductUpdatedAuditEvent(transaction: Transaction, input: {
    readonly organizationId: string;
    readonly actorId: string;
    readonly productId: string;
    readonly operation: "ADD" | "EDIT" | "REMOVE";
    readonly changedFields?: readonly ProductMaterialEditableField[];
    readonly correlationId: string;
  }): Promise<void>;
}

export interface ProductMaterialsCurrentDraftDependencies<Transaction> {
  readonly transactionRunner: {
    run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
  };
  readonly persistence: ProductMaterialsCurrentDraftPersistence<Transaction>;
}

export class ProductMaterialsCurrentDraftPersistenceError extends Error {}
