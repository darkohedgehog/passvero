import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export const CN_CLASSIFICATION_EDITABLE_FIELDS = ["value", "nomenclatureYear"] as const;
export type CnClassificationEditableField = typeof CN_CLASSIFICATION_EDITABLE_FIELDS[number];

export interface CnClassificationValues {
  readonly value: string;
  readonly nomenclatureYear: number;
}

export interface CnClassificationConcurrencyEvidence {
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
}

export interface AddCnClassificationCommand
extends CnClassificationValues, CnClassificationConcurrencyEvidence {
  readonly productId: string;
}

export interface EditCnClassificationCommand extends AddCnClassificationCommand {
  readonly identifierId: string;
  readonly expectedIdentifierUpdatedAt: string;
}

export interface RemoveCnClassificationCommand extends CnClassificationConcurrencyEvidence {
  readonly productId: string;
  readonly identifierId: string;
  readonly expectedIdentifierUpdatedAt: string;
}

export interface CurrentDraftCnClassification extends CnClassificationValues {
  readonly identifierId: string;
  readonly updatedAt: Date;
}

export interface CurrentDraftCnClassificationResult {
  readonly productId: string;
  readonly cn: CurrentDraftCnClassification | null;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
}

export type GetCurrentDraftCnClassification = (
  query: { readonly productId: string },
  context: AuthenticatedUserContext | null,
) => Promise<CurrentDraftCnClassificationResult>;

export type AddCnClassification = (
  command: AddCnClassificationCommand,
  context: AuthenticatedUserContext | null,
) => Promise<{ readonly productId: string; readonly status: "ADDED" }>;

export type EditCnClassification = (
  command: EditCnClassificationCommand,
  context: AuthenticatedUserContext | null,
) => Promise<{ readonly productId: string; readonly status: "UPDATED" | "NO_CHANGE" }>;

export type RemoveCnClassification = (
  command: RemoveCnClassificationCommand,
  context: AuthenticatedUserContext | null,
) => Promise<{ readonly productId: string; readonly status: "REMOVED" }>;
