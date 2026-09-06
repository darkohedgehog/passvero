import type { AuthenticatedUserContext, MembershipRole, MembershipStatus } from "@/src/application/context/authenticated-user-context";
import type { QrFormat, QrStatus } from "./contracts";

export interface QrRecord {
  readonly id: string;
  readonly passportId: string;
  readonly code: string;
  readonly targetUrl: string;
  readonly status: QrStatus;
  readonly generatedAt: Date;
  readonly activatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface ProductQrRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly lifecycleStatus: "ACTIVE" | "ARCHIVED";
  readonly publicCode: string;
  readonly currentPublishedVersionId: string | null;
  readonly version: null | {
    readonly id: string; readonly productId: string; readonly organizationId: string;
    readonly status: string; readonly sourceLocale: string;
  };
  readonly passports: readonly {
    readonly id: string; readonly productId: string; readonly organizationId: string;
    readonly status: "ACTIVE" | "WITHDRAWN" | "ARCHIVED";
    readonly qrCodes: readonly QrRecord[];
  }[];
}
export interface QrEvidenceClaims {
  readonly status: QrStatus;
  readonly identity: string;
  readonly revision: string;
}
export interface QrEvidence {
  issue(qr: QrRecord): string;
  read(value: string): QrEvidenceClaims | null;
  fingerprint(qr: QrRecord): QrEvidenceClaims;
}
export type QrTransactionMode = "READ" | "ACTIVATE";
export interface ProductQrPersistence<Transaction> {
  readEligibility(tx: Transaction, context: AuthenticatedUserContext, mode: QrTransactionMode): Promise<null | {
    readonly organizationStatus: string; readonly membershipStatus: MembershipStatus; readonly membershipRole: MembershipRole;
  }>;
  readProduct(tx: Transaction, productId: string, organizationId: string, mode: QrTransactionMode): Promise<ProductQrRecord | null>;
  publicEligible(tx: Transaction, publicCode: string, sourceLocale: string): Promise<boolean>;
  activate(tx: Transaction, input: {
    qr: QrRecord; at: Date; context: AuthenticatedUserContext;
  }): Promise<boolean>;
}
export interface ProductQrDependencies<Transaction> {
  readonly transactionRunner: {
    run<Result>(mode: QrTransactionMode, work: (tx: Transaction) => Promise<Result>): Promise<Result>;
  };
  readonly persistence: ProductQrPersistence<Transaction>;
  readonly evidence: QrEvidence;
  readonly canonicalOrigin: string;
  readonly now: () => Date;
  readonly renderer: { render(targetUrl: string, format: QrFormat): Promise<Uint8Array> };
}
