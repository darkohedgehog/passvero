import { ApplicationError } from "@/src/application/errors/application-error";
import type {
  AddCnClassificationCommand,
  CnClassificationConcurrencyEvidence,
  EditCnClassificationCommand,
  RemoveCnClassificationCommand,
} from "@/src/application/products/cn-classification-current-draft/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CONTIGUOUS_CN = /^[0-9]{8}$/;
const GROUPED_CN = /^[0-9]{4} [0-9]{2} [0-9]{2}$/;

export interface NormalizedCnEvidence {
  readonly productId: string;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
}

export interface NormalizedAddCnClassificationCommand extends NormalizedCnEvidence {
  readonly value: string;
  readonly nomenclatureYear: number;
}

export interface NormalizedEditCnClassificationCommand extends NormalizedAddCnClassificationCommand {
  readonly identifierId: string;
  readonly expectedIdentifierUpdatedAt: Date;
}

export interface NormalizedRemoveCnClassificationCommand extends NormalizedCnEvidence {
  readonly identifierId: string;
  readonly expectedIdentifierUpdatedAt: Date;
}

export function normalizeCnCode(value: string, correlationId: string): string {
  if (typeof value !== "string") throw invalid("CN_CLASSIFICATION_VALUE_INVALID", correlationId);
  const trimmed = value.trim();
  if (CONTIGUOUS_CN.test(trimmed)) return trimmed;
  if (GROUPED_CN.test(trimmed)) return trimmed.slice(0, 4) + trimmed.slice(5, 7) + trimmed.slice(8, 10);
  throw invalid("CN_CLASSIFICATION_VALUE_INVALID", correlationId);
}

export function validateCnNomenclatureYear(
  value: number,
  currentUtcYear: number,
  correlationId: string,
): number {
  if (!Number.isInteger(value) || value < 1988 || value > currentUtcYear || value > 9999) {
    throw invalid("CN_CLASSIFICATION_NOMENCLATURE_YEAR_INVALID", correlationId);
  }
  return value;
}

export function normalizeAddCnClassificationCommand(
  command: AddCnClassificationCommand,
  correlationId: string,
  currentUtcYear: number,
): NormalizedAddCnClassificationCommand {
  return {
    ...normalizeEvidence(command, correlationId),
    value: normalizeCnCode(command.value, correlationId),
    nomenclatureYear: validateCnNomenclatureYear(command.nomenclatureYear, currentUtcYear, correlationId),
  };
}

export function normalizeEditCnClassificationCommand(
  command: EditCnClassificationCommand,
  correlationId: string,
  currentUtcYear: number,
): NormalizedEditCnClassificationCommand {
  return {
    ...normalizeAddCnClassificationCommand(command, correlationId, currentUtcYear),
    identifierId: validateIdentifierId(command.identifierId, correlationId),
    expectedIdentifierUpdatedAt: parseTimestamp(command.expectedIdentifierUpdatedAt, correlationId),
  };
}

export function normalizeRemoveCnClassificationCommand(
  command: RemoveCnClassificationCommand,
  correlationId: string,
): NormalizedRemoveCnClassificationCommand {
  return {
    ...normalizeEvidence(command, correlationId),
    identifierId: validateIdentifierId(command.identifierId, correlationId),
    expectedIdentifierUpdatedAt: parseTimestamp(command.expectedIdentifierUpdatedAt, correlationId),
  };
}

function normalizeEvidence(
  command: CnClassificationConcurrencyEvidence & { readonly productId: string },
  correlationId: string,
): NormalizedCnEvidence {
  if (!UUID.test(command.productId) || !UUID.test(command.expectedDraftVersionId)) {
    throw invalid("CN_CLASSIFICATION_CONCURRENCY_INVALID", correlationId);
  }
  return {
    productId: command.productId,
    expectedDraftVersionId: command.expectedDraftVersionId,
    expectedProductUpdatedAt: parseTimestamp(command.expectedProductUpdatedAt, correlationId),
    expectedDraftUpdatedAt: parseTimestamp(command.expectedDraftUpdatedAt, correlationId),
  };
}

function validateIdentifierId(value: string, correlationId: string): string {
  if (!UUID.test(value)) throw invalid("CN_CLASSIFICATION_IDENTIFIER_ID_INVALID", correlationId);
  return value;
}

function parseTimestamp(value: string, correlationId: string): Date {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) {
    throw invalid("CN_CLASSIFICATION_CONCURRENCY_INVALID", correlationId);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw invalid("CN_CLASSIFICATION_CONCURRENCY_INVALID", correlationId);
  }
  return parsed;
}

function invalid(code: string, correlationId: string): ApplicationError {
  return new ApplicationError("VALIDATION", code, "Invalid CN classification input.", false, correlationId);
}
