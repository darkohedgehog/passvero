import type {
  GetPublicDpp,
  GetPublicDppResult,
} from "@/src/application/public-dpp/contracts";
import { PUBLIC_DPP_LOCALES } from "@/src/application/public-dpp/contracts";
import { isPublicDppLocale, resolvePublicDppLocale } from "@/src/application/public-dpp/locale";
import type { PublicDppPersistence } from "@/src/application/public-dpp/ports";

const PUBLIC_CODE = /^[A-Za-z0-9_-]{22}$/;
const CN_CODE = /^\d{8}$/;

export function createGetPublicDppService(dependencies: {
  readonly persistence: PublicDppPersistence;
}): GetPublicDpp {
  return async (query) => {
    if (!PUBLIC_CODE.test(query.publicCode)) return { kind: "NOT_FOUND" };
    try {
      const authority = await dependencies.persistence.readAuthorityByPublicCode(query.publicCode);
      if (authority === null
        || authority.productLifecycleStatus !== "ACTIVE"
        || authority.organizationStatus !== "ACTIVE") {
        return { kind: "NOT_FOUND" };
      }
      const passport = authority.passport;
      if (passport === null || passport.status === "ARCHIVED") return { kind: "NOT_FOUND" };
      if (!passport.ownershipConsistent) return unavailable();
      if (passport.status === "WITHDRAWN") {
        return {
          kind: "WITHDRAWN",
          publicMessage: presentText(passport.publicWithdrawalMessage),
        };
      }
      if (!authority.hasCurrentPublishedVersion) return { kind: "NOT_FOUND" };
      if (!presentText(authority.organizationDisplayName)
        || authority.productLastPublishedAt === null
        || passport.lastPublishedAt === null
        || passport.firstPublishedAt.getTime() > passport.lastPublishedAt.getTime()) {
        return unavailable();
      }

      const content = await dependencies.persistence.readCurrentPublishedContentByPublicCode(query.publicCode);
      if (content === null
        || !content.ownershipConsistent
        || content.versionNumber === null
        || !Number.isSafeInteger(content.versionNumber)
        || content.versionNumber < 1
        || content.publishedAt === null
        || content.publishedAt.getTime() !== authority.productLastPublishedAt.getTime()
        || content.publishedAt.getTime() !== passport.lastPublishedAt.getTime()
        || !isPublicDppLocale(content.sourceLocale)) {
        return unavailable();
      }

      const sourceTranslation = content.translations.find(({ locale }) => locale === content.sourceLocale);
      if (sourceTranslation === undefined || !validProductName(sourceTranslation.productName)) return unavailable();
      const availableLocales = PUBLIC_DPP_LOCALES.filter((locale) =>
        content.translations.some((translation) => translation.locale === locale));
      const locale = resolvePublicDppLocale(
        query.requestedLocale,
        query.acceptLanguage,
        availableLocales,
        passport.defaultLocale,
        content.sourceLocale,
      );
      if (locale === null) return unavailable();
      const translation = content.translations.find((candidate) => candidate.locale === locale);
      if (translation === undefined || !validProductName(translation.productName)) return unavailable();
      if (content.cnRows.length > 1) return unavailable();
      const cnRow = content.cnRows[0];
      if (cnRow !== undefined
        && (!CN_CODE.test(cnRow.value)
          || cnRow.nomenclatureYear === null
          || !Number.isInteger(cnRow.nomenclatureYear)
          || cnRow.nomenclatureYear < 1988)) {
        return unavailable();
      }

      const publicTranslation = {
        productName: translation.productName,
        shortDescription: translation.shortDescription,
        description: translation.description,
        technicalDescription: translation.technicalDescription,
        repairInstructions: translation.repairInstructions,
        sparePartsInformation: translation.sparePartsInformation,
        recyclingInstructions: translation.recyclingInstructions,
        disposalInstructions: translation.disposalInstructions,
        packagingInformation: translation.packagingInformation,
        safetyInformation: translation.safetyInformation,
        warrantyInformation: translation.warrantyInformation,
        publicNotes: translation.publicNotes,
      };
      return {
        kind: "PUBLIC",
        dpp: {
          locale,
          availableLocales,
          passport: { status: "ACTIVE", firstPublishedAt: passport.firstPublishedAt.toISOString() },
          organization: { displayName: authority.organizationDisplayName },
          version: { number: content.versionNumber, publishedAt: content.publishedAt.toISOString() },
          content: publicTranslation,
          materials: content.materials,
          cn: cnRow === undefined ? null : { code: cnRow.value, nomenclatureYear: cnRow.nomenclatureYear! },
        },
      } satisfies GetPublicDppResult;
    } catch {
      return unavailable();
    }
  };
}

function unavailable(): GetPublicDppResult {
  return { kind: "TEMPORARILY_UNAVAILABLE" };
}

function presentText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function validProductName(value: string): boolean {
  return value === value.trim() && Array.from(value).length >= 1 && Array.from(value).length <= 200;
}
