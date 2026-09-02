export const PUBLIC_DPP_LOCALES = ["hr", "sr", "en", "de", "sl", "pl"] as const;

export type PublicDppLocale = (typeof PUBLIC_DPP_LOCALES)[number];

export interface PublicDpp {
  readonly locale: PublicDppLocale;
  readonly availableLocales: readonly PublicDppLocale[];
  readonly passport: {
    readonly status: "ACTIVE";
    readonly firstPublishedAt: string;
  };
  readonly organization: {
    readonly displayName: string;
  };
  readonly version: {
    readonly number: number;
    readonly publishedAt: string;
  };
  readonly content: PublicDppTranslation;
  readonly materials: readonly PublicDppMaterial[];
  readonly cn: PublicDppCn | null;
}

export interface PublicDppTranslation {
  readonly productName: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly technicalDescription: string | null;
  readonly repairInstructions: string | null;
  readonly sparePartsInformation: string | null;
  readonly recyclingInstructions: string | null;
  readonly disposalInstructions: string | null;
  readonly packagingInformation: string | null;
  readonly safetyInformation: string | null;
  readonly warrantyInformation: string | null;
  readonly publicNotes: string | null;
}

export interface PublicDppMaterial {
  readonly materialName: string;
  readonly category: string | null;
  readonly percentage: string | null;
  readonly isRecycled: boolean;
  readonly recycledPercentage: string | null;
}

export interface PublicDppCn {
  readonly code: string;
  readonly nomenclatureYear: number;
}

export type GetPublicDppResult =
  | { readonly kind: "PUBLIC"; readonly dpp: PublicDpp }
  | { readonly kind: "WITHDRAWN"; readonly publicMessage: string | null }
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "TEMPORARILY_UNAVAILABLE" };

export interface GetPublicDppQuery {
  readonly publicCode: string;
  readonly requestedLocale: unknown;
  readonly acceptLanguage: string | null;
}

export type GetPublicDpp = (query: GetPublicDppQuery) => Promise<GetPublicDppResult>;
