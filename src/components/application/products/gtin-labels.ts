import type { PublicDppLocale } from "@/src/application/public-dpp/contracts";

export const gtinPublicLabels = {
  "hr": {
    "barcode": "Barkod",
    "notice": "Jedan neobavezni GTIN za trgovačku jedinicu koju ovaj proizvod opisuje. Provjeravamo format i kontrolnu znamenku, ne GS1 registraciju ili vlasništvo. Barkod je prikaz u aplikaciji, bez potvrde kvalitete za tisak. QR zasebno vodi na DPP."
  },
  "en": {
    "barcode": "Barcode",
    "notice": "One optional GTIN for the trade item described by this product. We check format and check digit, not GS1 registration or ownership. The barcode is an in-app display, without print quality certification. The separate QR links to the DPP."
  },
  "de": {
    "barcode": "Strichcode",
    "notice": "Eine optionale GTIN für den beschriebenen Handelsartikel. Geprüft werden Format und Prüfziffer, nicht die GS1-Registrierung oder Inhaberschaft. Der Strichcode dient zur Anzeige in der Anwendung, ohne Zertifizierung der Druckqualität. Der separate QR-Code führt zum DPP."
  },
  "sr": {
    "barcode": "Barkod",
    "notice": "Jedan opcioni GTIN za trgovačku jedinicu koju ovaj proizvod opisuje. Proveravamo format i kontrolnu cifru, ne GS1 registraciju ili vlasništvo. Barkod je prikaz u aplikaciji, bez potvrde kvaliteta za štampu. QR odvojeno vodi na DPP."
  },
  "sl": {
    "barcode": "Črtna koda",
    "notice": "En neobvezen GTIN za opisano trgovsko enoto. Preverjamo obliko in kontrolno števko, ne registracije GS1 ali lastništva. Črtna koda je prikaz v aplikaciji, brez potrditve kakovosti tiska. Ločena koda QR vodi do DPP."
  },
  "pl": {
    "barcode": "Kod kreskowy",
    "notice": "Jeden opcjonalny GTIN dla opisanej jednostki handlowej. Sprawdzamy format i cyfrę kontrolną, a nie rejestrację GS1 ani własność. Kod kreskowy służy do wyświetlania w aplikacji, bez certyfikacji jakości druku. Osobny kod QR prowadzi do DPP."
  }
} satisfies Record<PublicDppLocale, { barcode: string; notice: string }>;
