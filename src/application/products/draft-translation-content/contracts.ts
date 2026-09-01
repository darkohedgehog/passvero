import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export const DRAFT_TRANSLATION_CONTENT_FIELDS = [
  "shortDescription", "description", "technicalDescription", "repairInstructions",
  "sparePartsInformation", "recyclingInstructions", "disposalInstructions",
  "packagingInformation", "safetyInformation",
] as const;

export type DraftTranslationContentField = typeof DRAFT_TRANSLATION_CONTENT_FIELDS[number];
export type DraftTranslationContentValues = Readonly<Record<DraftTranslationContentField, string | null>>;

export interface DraftTranslationContentEditResult extends DraftTranslationContentValues {
  readonly productId: string;
  readonly sourceLocale: string;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
  readonly expectedSourceTranslationUpdatedAt: Date;
}

export interface UpdateDraftTranslationContentCommand extends DraftTranslationContentValues {
  readonly productId: string;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
  readonly expectedSourceTranslationUpdatedAt: string;
}

export type GetDraftTranslationContentForEdit = (
  query: { readonly productId: string }, context: AuthenticatedUserContext | null,
) => Promise<DraftTranslationContentEditResult>;

export type UpdateDraftTranslationContent = (
  command: UpdateDraftTranslationContentCommand, context: AuthenticatedUserContext | null,
) => Promise<{ readonly productId: string; readonly status: "UPDATED" | "NO_CHANGE" }>;
