import type { PublicDppLocale } from "@/src/application/public-dpp/contracts";
import type { PublicDppLabels } from "@/src/components/public-dpp/public-dpp-document";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import hr from "@/messages/hr.json";
import pl from "@/messages/pl.json";
import sl from "@/messages/sl.json";
import sr from "@/messages/sr.json";

const labels = {
  hr: { ...hr.PublicDpp, documentCategories: hr.ProductDocuments.categories },
  sr: { ...sr.PublicDpp, documentCategories: sr.ProductDocuments.categories },
  en: { ...en.PublicDpp, documentCategories: en.ProductDocuments.categories },
  de: { ...de.PublicDpp, documentCategories: de.ProductDocuments.categories },
  sl: { ...sl.PublicDpp, documentCategories: sl.ProductDocuments.categories },
  pl: { ...pl.PublicDpp, documentCategories: pl.ProductDocuments.categories },
} satisfies Record<PublicDppLocale, PublicDppLabels>;

export function getPublicDppLabels(locale: PublicDppLocale): PublicDppLabels {
  return labels[locale];
}
