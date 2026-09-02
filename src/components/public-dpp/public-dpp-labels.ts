import type { PublicDppLocale } from "@/src/application/public-dpp/contracts";
import type { PublicDppLabels } from "@/src/components/public-dpp/public-dpp-document";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import hr from "@/messages/hr.json";
import pl from "@/messages/pl.json";
import sl from "@/messages/sl.json";
import sr from "@/messages/sr.json";

const labels = {
  hr: hr.PublicDpp,
  sr: sr.PublicDpp,
  en: en.PublicDpp,
  de: de.PublicDpp,
  sl: sl.PublicDpp,
  pl: pl.PublicDpp,
} satisfies Record<PublicDppLocale, PublicDppLabels>;

export function getPublicDppLabels(locale: PublicDppLocale): PublicDppLabels {
  return labels[locale];
}
