import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_EDIT, PRODUCT_READ, roleHasProductPermission } from "@/src/application/permissions/product-permissions";
import type {
  AddCnClassification,
  AddCnClassificationCommand,
  CnClassificationEditableField,
  EditCnClassification,
  EditCnClassificationCommand,
  GetCurrentDraftCnClassification,
  RemoveCnClassification,
  RemoveCnClassificationCommand,
} from "@/src/application/products/cn-classification-current-draft/contracts";
import {
  normalizeAddCnClassificationCommand,
  normalizeEditCnClassificationCommand,
  normalizeRemoveCnClassificationCommand,
  type NormalizedAddCnClassificationCommand,
  type NormalizedEditCnClassificationCommand,
  type NormalizedRemoveCnClassificationCommand,
} from "@/src/application/products/cn-classification-current-draft/normalize-command";
import type {
  CnClassificationCurrentDraftDependencies,
  CnClassificationProductRecord,
  CnClassificationRecord,
  CnClassificationVersionRecord,
} from "@/src/application/products/cn-classification-current-draft/ports";
import { CnClassificationConflictPersistenceError } from "@/src/application/products/cn-classification-current-draft/ports";

export function createCnClassificationCurrentDraftServices<Transaction>(
  dependencies: CnClassificationCurrentDraftDependencies<Transaction>,
): { readonly get: GetCurrentDraftCnClassification; readonly add: AddCnClassification; readonly edit: EditCnClassification; readonly remove: RemoveCnClassification } {
  return {
    get: createGetService(dependencies),
    add: createAddService(dependencies),
    edit: createEditService(dependencies),
    remove: createRemoveService(dependencies),
  };
}

function createGetService<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>): GetCurrentDraftCnClassification {
  return async (query, context) => {
    if (context === null) throw safeError("UNAUTHENTICATED", "CN_CLASSIFICATION_UNAUTHENTICATED");
    if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_READ)) throw safeError("FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN", context.correlationId);
    if (!isUuid(query.productId)) throw safeError("VALIDATION", "CN_CLASSIFICATION_PRODUCT_ID_INVALID", context.correlationId);
    try {
      const record = await dependencies.persistence.findCurrentDraftByProductAndOrganization({ productId: query.productId, organizationId: context.organizationId });
      if (record === null) throw safeError("NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND", context.correlationId);
      if (record.productId !== query.productId || record.organizationId !== context.organizationId) throw safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", context.correlationId);
      const draft = record.currentDraftVersion;
      if (record.lifecycleStatus !== "ACTIVE" || record.currentDraftVersionId === null || draft === null) throw safeError("INVALID_STATE", "CN_CLASSIFICATION_DRAFT_NOT_EDITABLE", context.correlationId);
      validateDraft(record, draft, context.correlationId);
      const cn = draft.cn;
      if (cn !== null) validateCnRecord(cn, draft.productVersionId, context.correlationId);
      return {
        productId: record.productId,
        cn: cn === null ? null : { identifierId: cn.identifierId, value: cn.value, nomenclatureYear: cn.nomenclatureYear, updatedAt: cn.updatedAt },
        expectedDraftVersionId: draft.productVersionId,
        expectedProductUpdatedAt: record.updatedAt,
        expectedDraftUpdatedAt: draft.updatedAt,
      };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw safeError("INTERNAL", "CN_CLASSIFICATION_OPERATIONAL_FAILURE", context.correlationId);
    }
  };
}

function createAddService<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>): AddCnClassification {
  return async (command, context) => {
    try {
      return await runMutation(dependencies, context, command, async (transaction, scope, trusted) => {
        const normalized = normalizeTrusted(() => normalizeAddCnClassificationCommand(command, scope.correlationId, dependencies.currentUtcYear()), trusted);
        const existing = await dependencies.persistence.readCurrentDraftCn(transaction, { productVersionId: scope.draft.productVersionId });
        if (existing !== null) throw trust(trusted, conflict(scope.correlationId));
        await lockAggregate(dependencies, transaction, scope, normalized);
        try {
          await dependencies.persistence.insertCn(transaction, { productVersionId: scope.draft.productVersionId, values: cnValues(normalized) });
        } catch (error) {
          if (error instanceof CnClassificationConflictPersistenceError) throw trust(trusted, conflict(scope.correlationId));
          throw error;
        }
        await audit(dependencies, transaction, scope, "ADD");
        return { productId: scope.product.productId, status: "ADDED" as const };
      });
    } catch (error) {
      if (!isStaleWrite(error) || context === null) throw error;
      await classifyStaleAdd(dependencies, command.productId, context.organizationId, context.correlationId);
      throw error;
    }
  };
}

async function classifyStaleAdd<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>, productId: string, organizationId: string, correlationId: string): Promise<void> {
  let record;
  try {
    record = await dependencies.persistence.findCurrentDraftByProductAndOrganization({ productId, organizationId });
  } catch {
    throw safeError("INTERNAL", "CN_CLASSIFICATION_OPERATIONAL_FAILURE", correlationId);
  }
  if (record === null) throw safeError("NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND", correlationId);
  if (record.productId !== productId || record.organizationId !== organizationId) throw safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", correlationId);
  const draft = record.currentDraftVersion;
  if (record.currentDraftVersionId === null || draft === null) return;
  if (draft.productVersionId !== record.currentDraftVersionId || draft.productId !== record.productId || draft.organizationId !== record.organizationId) {
    throw safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", correlationId);
  }
  if (draft.cn !== null) {
    validateCnRecord(draft.cn, draft.productVersionId, correlationId);
    throw conflict(correlationId);
  }
}

function createEditService<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>): EditCnClassification {
  return async (command, context) => runMutation(dependencies, context, command, async (transaction, scope, trusted) => {
    const current = await loadTarget(dependencies, transaction, scope, command.identifierId, trusted);
    const normalized = normalizeTrusted(() => normalizeEditCnClassificationCommand(command, scope.correlationId, dependencies.currentUtcYear()), trusted);
    if (!sameInstant(current.updatedAt, normalized.expectedIdentifierUpdatedAt)) throw trust(trusted, stale(scope.correlationId));
    const changedFields = changedFieldsFor(current, normalized);
    if (changedFields.length === 0) return { productId: scope.product.productId, status: "NO_CHANGE" as const };
    await lockAggregate(dependencies, transaction, scope, normalized);
    if (!await dependencies.persistence.updateCnIfCurrent(transaction, {
      identifierId: current.identifierId,
      productVersionId: scope.draft.productVersionId,
      expectedUpdatedAt: normalized.expectedIdentifierUpdatedAt,
      values: cnValues(normalized),
    })) throw trust(trusted, stale(scope.correlationId));
    await audit(dependencies, transaction, scope, "EDIT", changedFields);
    return { productId: scope.product.productId, status: "UPDATED" as const };
  });
}

function createRemoveService<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>): RemoveCnClassification {
  return async (command, context) => runMutation(dependencies, context, command, async (transaction, scope, trusted) => {
    const current = await loadTarget(dependencies, transaction, scope, command.identifierId, trusted);
    const normalized = normalizeTrusted(() => normalizeRemoveCnClassificationCommand(command, scope.correlationId), trusted);
    if (!sameInstant(current.updatedAt, normalized.expectedIdentifierUpdatedAt)) throw trust(trusted, stale(scope.correlationId));
    await lockAggregate(dependencies, transaction, scope, normalized);
    if (!await dependencies.persistence.deleteCnIfCurrent(transaction, {
      identifierId: current.identifierId,
      productVersionId: scope.draft.productVersionId,
      expectedUpdatedAt: normalized.expectedIdentifierUpdatedAt,
    })) throw trust(trusted, stale(scope.correlationId));
    await audit(dependencies, transaction, scope, "REMOVE");
    return { productId: scope.product.productId, status: "REMOVED" as const };
  });
}

async function runMutation<Transaction, Result>(
  dependencies: CnClassificationCurrentDraftDependencies<Transaction>,
  context: Parameters<AddCnClassification>[1],
  command: AddCnClassificationCommand | EditCnClassificationCommand | RemoveCnClassificationCommand,
  work: (transaction: Transaction, scope: MutationScope, trusted: WeakSet<ApplicationError>) => Promise<Result>,
): Promise<Result> {
  const trusted = new WeakSet<ApplicationError>();
  try {
    if (context === null) throw trust(trusted, safeError("UNAUTHENTICATED", "CN_CLASSIFICATION_UNAUTHENTICATED"));
    if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_EDIT)) throw trust(trusted, safeError("FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN", context.correlationId));
    return await dependencies.transactionRunner.run(async (transaction) => {
      const eligibility = await dependencies.persistence.readEligibility(transaction, { organizationId: context.organizationId, userId: context.userId, membershipId: context.membershipId });
      if (eligibility === null || eligibility.membershipStatus !== "ACTIVE" || eligibility.organizationStatus !== "ACTIVE" || !roleHasProductPermission(eligibility.membershipRole, PRODUCT_EDIT)) {
        throw trust(trusted, safeError("FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN", context.correlationId));
      }
      const product = await dependencies.persistence.readProduct(transaction, { productId: command.productId, organizationId: context.organizationId });
      if (product === null) throw trust(trusted, safeError("NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND", context.correlationId));
      if (product.productId !== command.productId || product.organizationId !== context.organizationId) throw trust(trusted, safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", context.correlationId));
      if (product.lifecycleStatus !== "ACTIVE" || product.currentDraftVersionId === null) throw trust(trusted, safeError("INVALID_STATE", "CN_CLASSIFICATION_DRAFT_NOT_EDITABLE", context.correlationId));
      if (product.currentDraftVersionId !== command.expectedDraftVersionId || !sameInstant(product.updatedAt, timestamp(command.expectedProductUpdatedAt))) throw trust(trusted, stale(context.correlationId));
      const draft = await dependencies.persistence.readDraftVersion(transaction, { productVersionId: product.currentDraftVersionId, productId: product.productId, organizationId: product.organizationId });
      if (draft === null) throw trust(trusted, safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", context.correlationId));
      try { validateDraft(product, draft, context.correlationId); } catch (error) { if (error instanceof ApplicationError) trusted.add(error); throw error; }
      if (!sameInstant(draft.updatedAt, timestamp(command.expectedDraftUpdatedAt))) throw trust(trusted, stale(context.correlationId));
      try { return await work(transaction, { product, draft, actorId: context.userId, correlationId: context.correlationId }, trusted); }
      catch (error) { if (error instanceof ApplicationError) trusted.add(error); throw error; }
    });
  } catch (error) {
    if (error instanceof ApplicationError && trusted.has(error)) throw error;
    throw safeError("INTERNAL", "CN_CLASSIFICATION_OPERATIONAL_FAILURE", context?.correlationId);
  }
}

async function loadTarget<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>, transaction: Transaction, scope: MutationScope, identifierId: string, trusted: WeakSet<ApplicationError>) {
  const current = await dependencies.persistence.readCurrentDraftCn(transaction, { productVersionId: scope.draft.productVersionId, identifierId });
  if (current === null) throw trust(trusted, safeError("NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND", scope.correlationId));
  validateCnRecord(current, scope.draft.productVersionId, scope.correlationId);
  if (current.identifierId !== identifierId) throw trust(trusted, safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", scope.correlationId));
  return current;
}

async function lockAggregate<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>, transaction: Transaction, scope: MutationScope, evidence: NormalizedAddCnClassificationCommand | NormalizedEditCnClassificationCommand | NormalizedRemoveCnClassificationCommand) {
  if (!await dependencies.persistence.touchProductIfCurrent(transaction, { productId: scope.product.productId, organizationId: scope.product.organizationId, currentDraftVersionId: scope.draft.productVersionId, expectedUpdatedAt: evidence.expectedProductUpdatedAt, actorId: scope.actorId })) throw stale(scope.correlationId);
  if (!await dependencies.persistence.touchDraftVersionIfCurrent(transaction, { productVersionId: scope.draft.productVersionId, productId: scope.product.productId, organizationId: scope.product.organizationId, expectedUpdatedAt: evidence.expectedDraftUpdatedAt, actorId: scope.actorId })) throw stale(scope.correlationId);
}

async function audit<Transaction>(dependencies: CnClassificationCurrentDraftDependencies<Transaction>, transaction: Transaction, scope: MutationScope, operation: "ADD" | "EDIT" | "REMOVE", changedFields?: readonly CnClassificationEditableField[]) {
  await dependencies.persistence.insertProductUpdatedAuditEvent(transaction, { organizationId: scope.product.organizationId, actorId: scope.actorId, productId: scope.product.productId, operation, ...(changedFields === undefined ? {} : { changedFields }), correlationId: scope.correlationId });
}

function validateDraft(product: CnClassificationProductRecord, draft: CnClassificationVersionRecord, correlationId: string) {
  if (draft.productVersionId !== product.currentDraftVersionId || draft.productId !== product.productId || draft.organizationId !== product.organizationId) throw safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", correlationId);
  if (draft.status !== "DRAFT" && draft.status !== "READY_FOR_REVIEW") throw safeError("INVALID_STATE", "CN_CLASSIFICATION_DRAFT_NOT_EDITABLE", correlationId);
}

function validateCnRecord(record: CnClassificationRecord, productVersionId: string, correlationId: string) {
  if (record.productVersionId !== productVersionId || record.type !== "CN") throw safeError("INTERNAL", "CN_CLASSIFICATION_INVARIANT_FAILURE", correlationId);
}

function cnValues(input: { readonly value: string; readonly nomenclatureYear: number }) {
  return { value: input.value, nomenclatureYear: input.nomenclatureYear, issuingAuthority: null, notes: null } as const;
}

function changedFieldsFor(current: CnClassificationRecord, next: { readonly value: string; readonly nomenclatureYear: number }): readonly CnClassificationEditableField[] {
  const changed: CnClassificationEditableField[] = [];
  if (current.value !== next.value) changed.push("value");
  if (current.nomenclatureYear !== next.nomenclatureYear) changed.push("nomenclatureYear");
  return changed;
}

type MutationScope = { readonly product: CnClassificationProductRecord; readonly draft: CnClassificationVersionRecord; readonly actorId: string; readonly correlationId: string };
function timestamp(value: string): Date { return new Date(value); }
function sameInstant(left: Date, right: Date): boolean { return left.getTime() === right.getTime(); }
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value); }
function stale(correlationId: string) { return safeError("CONFLICT", "CN_CLASSIFICATION_STALE_WRITE", correlationId); }
function conflict(correlationId: string) { return safeError("CONFLICT", "CN_CLASSIFICATION_CONFLICT", correlationId); }
function isStaleWrite(error: unknown): error is ApplicationError { return error instanceof ApplicationError && error.category === "CONFLICT" && error.code === "CN_CLASSIFICATION_STALE_WRITE"; }
function trust(set: WeakSet<ApplicationError>, error: ApplicationError) { set.add(error); return error; }
function normalizeTrusted<Result>(work: () => Result, set: WeakSet<ApplicationError>): Result { try { return work(); } catch (error) { if (error instanceof ApplicationError) set.add(error); throw error; } }
function safeError(category: ApplicationError["category"], code: string, correlationId?: string): ApplicationError {
  const message = category === "NOT_FOUND" ? "The requested product or CN classification was not found." : category === "FORBIDDEN" || category === "UNAUTHENTICATED" ? "CN classification access is not allowed." : category === "CONFLICT" ? "The CN classification changed or already exists." : category === "INVALID_STATE" ? "The current draft cannot be edited." : category === "VALIDATION" ? "Invalid CN classification input." : "The CN classification operation failed.";
  return new ApplicationError(category, code, message, false, correlationId);
}
