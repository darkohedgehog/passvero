import type { MembershipRole, MembershipStatus } from "@/src/application/context/authenticated-user-context";
import type { ProductLifecycleStatus, ProductVersionStatus } from "@/src/application/products/list-products/contracts";

export interface PublicationProductRecord {
  readonly productId: string;
  readonly organizationId: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly publicCode: string;
  readonly currentDraftVersionId: string | null;
  readonly currentPublishedVersionId: string | null;
  readonly updatedAt: Date;
}

export interface PublicationVersionRecord {
  readonly productVersionId: string;
  readonly productId: string;
  readonly organizationId: string;
  readonly status: ProductVersionStatus;
  readonly sourceLocale: string;
  readonly versionNumber: number | null;
  readonly updatedAt: Date;
  readonly reviewReadyAt: Date | null;
  readonly publishedAt: Date | null;
  readonly publishedById: string | null;
  readonly supersededAt: Date | null;
  readonly discardedAt: Date | null;
}

export interface PublicationPassportRecord {
  readonly passportId: string;
  readonly productId: string;
  readonly organizationId: string;
  readonly status: "ACTIVE" | "WITHDRAWN" | "ARCHIVED";
  readonly qrCode: null | {
    readonly qrCodeId: string;
    readonly code: string;
    readonly targetUrl: string;
    readonly status: "PENDING" | "ACTIVE" | "REVOKED";
  };
}

export interface PublishProductPersistence<Transaction> {
  readEligibility(transaction: Transaction, input: { organizationId: string; userId: string; membershipId: string }): Promise<null | { organizationStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION"; membershipStatus: MembershipStatus; membershipRole: MembershipRole }>;
  readProductForPublication(transaction: Transaction, input: { productId: string; organizationId: string }): Promise<PublicationProductRecord | null>;
  readVersion(transaction: Transaction, input: { productVersionId: string; productId: string; organizationId: string }): Promise<PublicationVersionRecord | null>;
  readReadiness(transaction: Transaction, input: { productVersionId: string; organizationId: string; sourceLocale: string; currentUtcYear: number }): Promise<{ sourceTranslationExists: boolean; sourceProductName: string | null; unavailablePublicAsset: boolean; invalidAuthoredAggregate: boolean }>;
  readPassport(transaction: Transaction, input: { productId: string; organizationId: string }): Promise<PublicationPassportRecord | null>;
  nextVersionNumber(transaction: Transaction, input: { productId: string; organizationId: string }): Promise<number>;
  applyPublication(transaction: Transaction, input: {
    organizationId: string; actorId: string; productId: string; draftVersionId: string;
    previousPublishedVersionId: string | null; expectedProductUpdatedAt: Date;
    expectedDraftUpdatedAt: Date; expectedCurrentPublishedVersionId: string | null;
    versionNumber: number; publishedAt: Date; sourceLocale: string;
    passport: PublicationPassportRecord | null; qrCode: string | null; qrTargetUrl: string;
    correlationId: string;
  }): Promise<"APPLIED" | "STALE">;
}

export interface PublishProductDependencies<Transaction> {
  readonly transactionRunner: { run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result> };
  readonly persistence: PublishProductPersistence<Transaction>;
  readonly now: () => Date;
  readonly generateQrCode: () => string;
  readonly canonicalOrigin: string;
}
