import type { ApplicationErrorCategory } from "@/src/application/errors/application-error";
import type {
  AuthenticatedUserContext,
  MembershipRole,
  MembershipStatus,
} from "@/src/application/context/authenticated-user-context";
import type {
  CreateProductCommand,
  CreateProductResult,
} from "@/src/application/products/create-product/contracts";
import type { ProductPublicCodeGenerator } from "@/src/application/products/create-product/public-code";
import type { PassveroLocale } from "@/src/domain/values/passvero-locale";

export interface TransactionRunner<Transaction> {
  run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

export type CreateProductPersistenceErrorKind =
  | "PUBLIC_CODE_CONFLICT"
  | "ORGANIZATION_SKU_CONFLICT"
  | "ACTIVE_DRAFT_CONFLICT"
  | "POINTER_CONFLICT"
  | "NOT_FOUND"
  | "UNKNOWN";

export class CreateProductPersistenceError extends Error {
  constructor(readonly kind: CreateProductPersistenceErrorKind) {
    super(kind);
  }
}

export interface ProductCreationEligibility {
  readonly organizationStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION";
  readonly membershipStatus: MembershipStatus;
  readonly membershipRole: MembershipRole;
}

export interface CreatedProductIdentity {
  readonly productId: string;
  readonly createdAt: Date;
}

export interface CreateProductPersistence<Transaction> {
  readEligibility(
    transaction: Transaction,
    input: { readonly organizationId: string; readonly userId: string; readonly membershipId: string },
  ): Promise<ProductCreationEligibility | null>;
  createProductIdentity(
    transaction: Transaction,
    input: {
      readonly organizationId: string;
      readonly internalName: string;
      readonly sku: string | null;
      readonly normalizedSku: string | null;
      readonly publicCode: string;
      readonly actorId: string;
    },
  ): Promise<CreatedProductIdentity>;
  createInitialProductVersion(
    transaction: Transaction,
    input: {
      readonly productId: string;
      readonly organizationId: string;
      readonly sourceLocale: PassveroLocale;
      readonly actorId: string;
    },
  ): Promise<{ readonly productVersionId: string }>;
  createInitialProductTranslation(
    transaction: Transaction,
    input: {
      readonly productVersionId: string;
      readonly locale: PassveroLocale;
      readonly productName: string;
    },
  ): Promise<{ readonly productTranslationId: string }>;
  assignCurrentDraftVersionIfUnset(
    transaction: Transaction,
    input: {
      readonly productId: string;
      readonly organizationId: string;
      readonly productVersionId: string;
    },
  ): Promise<boolean>;
  insertProductCreatedAuditEvent(
    transaction: Transaction,
    input: {
      readonly organizationId: string;
      readonly actorId: string;
      readonly productId: string;
      readonly initialProductVersionId: string;
      readonly skuSupplied: boolean;
      readonly correlationId: string;
    },
  ): Promise<{ readonly auditLogId: string }>;
}

export interface CreateProductTelemetry {
  recordSuccess(input: { readonly durationMs: number }): void;
  recordFailure(input: {
    readonly category: ApplicationErrorCategory;
    readonly durationMs: number;
  }): void;
  recordPublicCodeCollision(input: { readonly attempt: 1 | 2 | 3 }): void;
  recordPublicCodeExhaustion(): void;
}

export interface CreateProductDependencies<Transaction> {
  readonly transactionRunner: TransactionRunner<Transaction>;
  readonly persistence: CreateProductPersistence<Transaction>;
  readonly publicCodeGenerator: ProductPublicCodeGenerator;
  readonly monotonicNow: () => number;
  readonly telemetry: CreateProductTelemetry;
}

export type CreateProduct = (
  command: CreateProductCommand,
  context: AuthenticatedUserContext | null,
) => Promise<CreateProductResult>;
