import type { PublicDppMaterial, PublicDppTranslation } from "@/src/application/public-dpp/contracts";

export type PublicDppOrganizationStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION";

export interface PublicDppAuthorityRecord {
  readonly productLifecycleStatus: "ACTIVE" | "ARCHIVED";
  readonly organizationStatus: PublicDppOrganizationStatus;
  readonly organizationDisplayName: string;
  readonly hasCurrentPublishedVersion: boolean;
  readonly productLastPublishedAt: Date | null;
  readonly passport: null | {
    readonly ownershipConsistent: boolean;
    readonly status: "ACTIVE" | "WITHDRAWN" | "ARCHIVED";
    readonly defaultLocale: string | null;
    readonly firstPublishedAt: Date;
    readonly lastPublishedAt: Date | null;
    readonly publicWithdrawalMessage: string | null;
  };
}

export interface PublicDppContentRecord {
  readonly ownershipConsistent: boolean;
  readonly versionNumber: number | null;
  readonly publishedAt: Date | null;
  readonly sourceLocale: string;
  readonly translations: readonly (PublicDppTranslation & { readonly locale: string })[];
  readonly materials: readonly PublicDppMaterial[];
  readonly cnRows: readonly {
    readonly value: string;
    readonly nomenclatureYear: number | null;
  }[];
}

export interface PublicDppPersistence {
  readAuthorityByPublicCode(publicCode: string): Promise<PublicDppAuthorityRecord | null>;
  readCurrentPublishedContentByPublicCode(publicCode: string): Promise<PublicDppContentRecord | null>;
}
