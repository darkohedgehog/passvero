import {
  PUBLIC_DPP_LOCALES,
  type PublicDppLocale,
} from "@/src/application/public-dpp/contracts";

const localeSet = new Set<string>(PUBLIC_DPP_LOCALES);

export function isPublicDppLocale(value: string): value is PublicDppLocale {
  return localeSet.has(value);
}

export function normalizeRequestedPublicDppLocale(value: unknown): PublicDppLocale | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[A-Z]/g, (character) => character.toLowerCase());
  return isPublicDppLocale(normalized) ? normalized : null;
}

export function resolvePublicDppLocale(
  requestedLocale: unknown,
  acceptLanguage: string | null,
  availableLocales: readonly PublicDppLocale[],
  defaultLocale: string | null,
  sourceLocale: string,
): PublicDppLocale | null {
  const available = new Set<PublicDppLocale>(availableLocales);
  const explicit = normalizeRequestedPublicDppLocale(requestedLocale);
  if (explicit !== null) {
    if (available.has(explicit)) return explicit;
  } else {
    const negotiated = negotiateAcceptLanguage(acceptLanguage, available);
    if (negotiated !== null) return negotiated;
  }
  if (defaultLocale !== null && isPublicDppLocale(defaultLocale) && available.has(defaultLocale)) {
    return defaultLocale;
  }
  return isPublicDppLocale(sourceLocale) && available.has(sourceLocale) ? sourceLocale : null;
}

function negotiateAcceptLanguage(
  header: string | null,
  available: ReadonlySet<PublicDppLocale>,
): PublicDppLocale | null {
  if (header === null) return null;
  const preferences = header.split(",").flatMap((part, index) => {
    const [rawRange, ...parameters] = part.trim().split(";");
    const range = rawRange?.toLowerCase() ?? "";
    const primary = /^([a-z]{2})(?:-[a-z0-9]{1,8})*$/.exec(range)?.[1];
    if (primary === undefined || !isPublicDppLocale(primary)) return [];
    let quality = 1;
    for (const parameter of parameters) {
      const match = /^\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*$/i.exec(parameter);
      if (match === null) continue;
      quality = Number(match[1]);
    }
    return quality === 0 ? [] : [{ locale: primary, quality, index }];
  });
  preferences.sort((left, right) => right.quality - left.quality || left.index - right.index);
  return preferences.find(({ locale }) => available.has(locale))?.locale ?? null;
}
