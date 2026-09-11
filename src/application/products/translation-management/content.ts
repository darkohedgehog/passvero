import { DRAFT_TRANSLATION_CONTENT_FIELDS } from "../draft-translation-content/contracts";
import { MAX_DRAFT_TRANSLATION_CONTENT_CODE_POINTS } from "../draft-translation-content/normalize-command";

export const TRANSLATION_TEXT_FIELDS = [...DRAFT_TRANSLATION_CONTENT_FIELDS, "warrantyInformation", "publicNotes"] as const;
export type TranslationTextField = typeof TRANSLATION_TEXT_FIELDS[number];
export type TranslationContent = Readonly<{ productName: string } & Record<TranslationTextField, string | null>>;

export function emptyTranslation(): TranslationContent {
  return { productName: "", shortDescription: null, description: null, technicalDescription: null,
    repairInstructions: null, sparePartsInformation: null, recyclingInstructions: null,
    disposalInstructions: null, packagingInformation: null, safetyInformation: null,
    warrantyInformation: null, publicNotes: null };
}

export function normalizeTranslation(input: unknown): TranslationContent {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Invalid translation.");
  const row = input as Record<string, unknown>;
  const keys = ["productName", ...TRANSLATION_TEXT_FIELDS];
  if (Object.keys(row).length !== keys.length || !keys.every(key => key in row)) throw new Error("Invalid translation.");
  if (typeof row.productName !== "string" || Array.from(row.productName.trim()).length > 200) throw new Error("Invalid name.");
  const values = { ...emptyTranslation(), productName: row.productName.trim() };
  for (const key of TRANSLATION_TEXT_FIELDS) {
    const value = row[key];
    if (value !== null && typeof value !== "string") throw new Error("Invalid content.");
    if (value !== null && Array.from(value.trim()).length > MAX_DRAFT_TRANSLATION_CONTENT_CODE_POINTS) throw new Error("Invalid content.");
    values[key] = value?.trim() || null;
  }
  return values;
}

export function translationReady(content: TranslationContent): boolean {
  return content.productName === content.productName.trim()
    && Array.from(content.productName).length >= 1 && Array.from(content.productName).length <= 200;
}

export function canLeaveTranslation(dirty: boolean, confirmDiscard: () => boolean): boolean {
  return !dirty || confirmDiscard();
}
