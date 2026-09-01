import { ApplicationError } from "@/src/application/errors/application-error";
import {
  DRAFT_TRANSLATION_CONTENT_FIELDS,
  type DraftTranslationContentValues,
  type UpdateDraftTranslationContentCommand,
} from "@/src/application/products/draft-translation-content/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const MAX_DRAFT_TRANSLATION_CONTENT_CODE_POINTS = 5_000;

export interface NormalizedDraftTranslationContentCommand extends DraftTranslationContentValues {
  readonly productId: string;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
  readonly expectedSourceTranslationUpdatedAt: Date;
}

export function normalizeDraftTranslationContentCommand(
  command: UpdateDraftTranslationContentCommand,
  correlationId: string,
): NormalizedDraftTranslationContentCommand {
  if (!UUID.test(command.productId) || !UUID.test(command.expectedDraftVersionId)) {
    throw invalid("DRAFT_TRANSLATION_CONTENT_CONCURRENCY_INVALID", correlationId);
  }
  const values = {} as Record<keyof DraftTranslationContentValues, string | null>;
  for (const field of DRAFT_TRANSLATION_CONTENT_FIELDS) {
    const raw: unknown = command[field];
    if (raw !== null && typeof raw !== "string") {
      throw invalid(`DRAFT_TRANSLATION_CONTENT_${field.toUpperCase()}_INVALID`, correlationId);
    }
    const normalized = raw?.trim() || null;
    if (normalized !== null && Array.from(normalized).length > MAX_DRAFT_TRANSLATION_CONTENT_CODE_POINTS) {
      throw invalid(`DRAFT_TRANSLATION_CONTENT_${field.toUpperCase()}_INVALID`, correlationId);
    }
    values[field] = normalized;
  }
  return {
    productId: command.productId,
    ...values,
    expectedDraftVersionId: command.expectedDraftVersionId,
    expectedProductUpdatedAt: parseTimestamp(command.expectedProductUpdatedAt, correlationId),
    expectedDraftUpdatedAt: parseTimestamp(command.expectedDraftUpdatedAt, correlationId),
    expectedSourceTranslationUpdatedAt: parseTimestamp(command.expectedSourceTranslationUpdatedAt, correlationId),
  };
}

function parseTimestamp(value: string, correlationId: string): Date {
  if (!TIMESTAMP.test(value)) throw invalid("DRAFT_TRANSLATION_CONTENT_CONCURRENCY_INVALID", correlationId);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw invalid("DRAFT_TRANSLATION_CONTENT_CONCURRENCY_INVALID", correlationId);
  }
  return date;
}

function invalid(code: string, correlationId: string): ApplicationError {
  return new ApplicationError("VALIDATION", code, "The draft content request is invalid.", false, correlationId);
}
