import { ApplicationError } from "@/src/application/errors/application-error";
import {
  hasProductPermission,
  PRODUCT_EDIT,
  PRODUCT_READ,
  roleHasProductPermission,
} from "@/src/application/permissions/product-permissions";
import type {
  AddProductMaterial,
  AddProductMaterialCommand,
  EditProductMaterial,
  EditProductMaterialCommand,
  GetCurrentDraftMaterials,
  ProductMaterialEditableField,
  ProductMaterialValues,
  RemoveProductMaterial,
  RemoveProductMaterialCommand,
} from "@/src/application/products/product-materials-current-draft/contracts";
import {
  normalizeAddProductMaterialCommand,
  normalizeEditProductMaterialCommand,
  normalizeRemoveProductMaterialCommand,
  percentageToHundredths,
  type NormalizedAddProductMaterialCommand,
  type NormalizedEditProductMaterialCommand,
  type NormalizedRemoveProductMaterialCommand,
} from "@/src/application/products/product-materials-current-draft/normalize-command";
import type {
  ProductMaterialRecord,
  ProductMaterialsCurrentDraftDependencies,
  ProductMaterialsProductRecord,
  ProductMaterialsVersionRecord,
} from "@/src/application/products/product-materials-current-draft/ports";

const MAX_COLLECTION_HUNDREDTHS = BigInt(10_000);

export function createProductMaterialsCurrentDraftServices<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
): {
  readonly get: GetCurrentDraftMaterials;
  readonly add: AddProductMaterial;
  readonly edit: EditProductMaterial;
  readonly remove: RemoveProductMaterial;
} {
  return {
    get: createGetService(dependencies),
    add: createAddService(dependencies),
    edit: createEditService(dependencies),
    remove: createRemoveService(dependencies),
  };
}

function createGetService<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
): GetCurrentDraftMaterials {
  return async (query, context) => {
    if (context === null) throw safeError("UNAUTHENTICATED", "PRODUCT_MATERIALS_UNAUTHENTICATED");
    if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_READ)) {
      throw safeError("FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN", context.correlationId);
    }
    if (!isUuid(query.productId)) {
      throw safeError("VALIDATION", "PRODUCT_MATERIALS_PRODUCT_ID_INVALID", context.correlationId);
    }
    try {
      const record = await dependencies.persistence.findCurrentDraftByProductAndOrganization({
        productId: query.productId,
        organizationId: context.organizationId,
      });
      if (record === null) throw safeError("NOT_FOUND", "PRODUCT_MATERIALS_NOT_FOUND", context.correlationId);
      if (record.productId !== query.productId || record.organizationId !== context.organizationId) {
        throw safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", context.correlationId);
      }
      const draft = record.currentDraftVersion;
      if (record.currentDraftVersionId === null || draft === null) {
        throw safeError("INVALID_STATE", "PRODUCT_MATERIALS_DRAFT_NOT_EDITABLE", context.correlationId);
      }
      validateDraft(record, draft, context.correlationId);
      return {
        productId: record.productId,
        expectedDraftVersionId: draft.productVersionId,
        expectedProductUpdatedAt: record.updatedAt,
        expectedDraftUpdatedAt: draft.updatedAt,
        materials: draft.materials.map((material) => {
          if (material.productVersionId !== draft.productVersionId) {
            throw safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", context.correlationId);
          }
          return {
            materialId: material.materialId,
            materialName: material.materialName,
            category: material.category,
            percentage: material.percentage,
            isRecycled: material.isRecycled,
            recycledPercentage: material.recycledPercentage,
            updatedAt: material.updatedAt,
          };
        }),
      };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw safeError("INTERNAL", "PRODUCT_MATERIALS_OPERATIONAL_FAILURE", context.correlationId);
    }
  };
}

function createAddService<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
): AddProductMaterial {
  return async (command, context) => runMutation(dependencies, context, async (transaction, scope, trusted) => {
    const normalized = normalizeTrusted(
      () => normalizeAddProductMaterialCommand(command, scope.correlationId),
      trusted,
    );
    const materials = await dependencies.persistence.readMaterials(transaction, {
      productVersionId: scope.draft.productVersionId,
    });
    validateCollectionOwnership(materials, scope.draft.productVersionId, scope.correlationId);
    assertCollectionTotal([...materials.map(({ percentage }) => percentage), normalized.percentage], scope.correlationId);
    await lockAggregate(dependencies, transaction, scope, normalized);
    await dependencies.persistence.insertMaterial(transaction, {
      productVersionId: scope.draft.productVersionId,
      values: materialValues(normalized),
    });
    await audit(dependencies, transaction, scope, "ADD");
    return { productId: scope.product.productId, status: "ADDED" as const };
  }, command);
}

function createEditService<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
): EditProductMaterial {
  return async (command, context) => runMutation(dependencies, context, async (transaction, scope, trusted) => {
    const material = await loadTargetMaterial(dependencies, transaction, scope, command.materialId);
    const normalized = normalizeTrusted(
      () => normalizeEditProductMaterialCommand(command, scope.correlationId),
      trusted,
    );
    if (!sameInstant(material.updatedAt, normalized.expectedMaterialUpdatedAt)) throw stale(scope.correlationId);
    const materials = await dependencies.persistence.readMaterials(transaction, {
      productVersionId: scope.draft.productVersionId,
    });
    validateCollectionOwnership(materials, scope.draft.productVersionId, scope.correlationId);
    if (!materials.some(({ materialId }) => materialId === material.materialId)) {
      throw safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", scope.correlationId);
    }
    assertCollectionTotal(
      materials.map((candidate) => candidate.materialId === material.materialId
        ? normalized.percentage
        : candidate.percentage),
      scope.correlationId,
    );
    const values = materialValues(normalized);
    const changedFields = changedMaterialFields(material, values);
    if (changedFields.length === 0) {
      return { productId: scope.product.productId, status: "NO_CHANGE" as const };
    }
    await lockAggregate(dependencies, transaction, scope, normalized);
    if (!await dependencies.persistence.updateMaterialIfCurrent(transaction, {
      materialId: material.materialId,
      productVersionId: scope.draft.productVersionId,
      expectedUpdatedAt: normalized.expectedMaterialUpdatedAt,
      values,
    })) throw stale(scope.correlationId);
    await audit(dependencies, transaction, scope, "EDIT", changedFields);
    return { productId: scope.product.productId, status: "UPDATED" as const };
  }, command);
}

function createRemoveService<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
): RemoveProductMaterial {
  return async (command, context) => runMutation(dependencies, context, async (transaction, scope, trusted) => {
    const material = await loadTargetMaterial(dependencies, transaction, scope, command.materialId);
    const normalized = normalizeTrusted(
      () => normalizeRemoveProductMaterialCommand(command, scope.correlationId),
      trusted,
    );
    if (!sameInstant(material.updatedAt, normalized.expectedMaterialUpdatedAt)) throw stale(scope.correlationId);
    const materials = await dependencies.persistence.readMaterials(transaction, {
      productVersionId: scope.draft.productVersionId,
    });
    validateCollectionOwnership(materials, scope.draft.productVersionId, scope.correlationId);
    if (!materials.some(({ materialId }) => materialId === material.materialId)) {
      throw safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", scope.correlationId);
    }
    assertCollectionTotal(
      materials.filter(({ materialId }) => materialId !== material.materialId).map(({ percentage }) => percentage),
      scope.correlationId,
    );
    await lockAggregate(dependencies, transaction, scope, normalized);
    if (!await dependencies.persistence.deleteMaterialIfCurrent(transaction, {
      materialId: material.materialId,
      productVersionId: scope.draft.productVersionId,
      expectedUpdatedAt: normalized.expectedMaterialUpdatedAt,
    })) throw stale(scope.correlationId);
    await audit(dependencies, transaction, scope, "REMOVE");
    return { productId: scope.product.productId, status: "REMOVED" as const };
  }, command);
}

async function runMutation<Transaction, Result>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
  context: Parameters<AddProductMaterial>[1],
  work: (
    transaction: Transaction,
    scope: MutationScope,
    trusted: WeakSet<ApplicationError>,
  ) => Promise<Result>,
  command: AddProductMaterialCommand | EditProductMaterialCommand | RemoveProductMaterialCommand,
): Promise<Result> {
  const trusted = new WeakSet<ApplicationError>();
  try {
    if (context === null) throw trust(trusted, safeError("UNAUTHENTICATED", "PRODUCT_MATERIALS_UNAUTHENTICATED"));
    if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_EDIT)) {
      throw trust(trusted, safeError("FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN", context.correlationId));
    }
    return await dependencies.transactionRunner.run(async (transaction) => {
      const eligibility = await dependencies.persistence.readEligibility(transaction, {
        organizationId: context.organizationId,
        userId: context.userId,
        membershipId: context.membershipId,
      });
      if (
        eligibility === null
        || eligibility.membershipStatus !== "ACTIVE"
        || eligibility.organizationStatus !== "ACTIVE"
        || !roleHasProductPermission(eligibility.membershipRole, PRODUCT_EDIT)
      ) {
        throw trust(trusted, safeError("FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN", context.correlationId));
      }
      const product = await dependencies.persistence.readProduct(transaction, {
        productId: command.productId,
        organizationId: context.organizationId,
      });
      if (product === null) throw trust(trusted, safeError("NOT_FOUND", "PRODUCT_MATERIALS_NOT_FOUND", context.correlationId));
      if (product.productId !== command.productId || product.organizationId !== context.organizationId) {
        throw trust(trusted, safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", context.correlationId));
      }
      if (product.lifecycleStatus !== "ACTIVE" || product.currentDraftVersionId === null) {
        throw trust(trusted, safeError("INVALID_STATE", "PRODUCT_MATERIALS_DRAFT_NOT_EDITABLE", context.correlationId));
      }
      if (
        product.currentDraftVersionId !== command.expectedDraftVersionId
        || !sameInstant(product.updatedAt, timestampFromCommand(command.expectedProductUpdatedAt))
      ) throw trust(trusted, stale(context.correlationId));
      const draft = await dependencies.persistence.readDraftVersion(transaction, {
        productVersionId: product.currentDraftVersionId,
        productId: product.productId,
        organizationId: product.organizationId,
      });
      if (draft === null) {
        throw trust(trusted, safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", context.correlationId));
      }
      try {
        validateDraft(product, draft, context.correlationId);
      } catch (error) {
        if (error instanceof ApplicationError) trusted.add(error);
        throw error;
      }
      if (!sameInstant(draft.updatedAt, timestampFromCommand(command.expectedDraftUpdatedAt))) {
        throw trust(trusted, stale(context.correlationId));
      }
      try {
        return await work(transaction, {
          product,
          draft,
          actorId: context.userId,
          correlationId: context.correlationId,
        }, trusted);
      } catch (error) {
        if (error instanceof ApplicationError) trusted.add(error);
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof ApplicationError && trusted.has(error)) throw error;
    throw safeError("INTERNAL", "PRODUCT_MATERIALS_OPERATIONAL_FAILURE", context?.correlationId);
  }
}

async function loadTargetMaterial<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
  transaction: Transaction,
  scope: MutationScope,
  materialId: string,
): Promise<ProductMaterialRecord> {
  const material = await dependencies.persistence.readMaterial(transaction, {
    materialId,
    productVersionId: scope.draft.productVersionId,
  });
  if (material === null) throw safeError("NOT_FOUND", "PRODUCT_MATERIALS_NOT_FOUND", scope.correlationId);
  if (material.materialId !== materialId || material.productVersionId !== scope.draft.productVersionId) {
    throw safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", scope.correlationId);
  }
  return material;
}

async function lockAggregate<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
  transaction: Transaction,
  scope: MutationScope,
  evidence: NormalizedAddProductMaterialCommand | NormalizedEditProductMaterialCommand | NormalizedRemoveProductMaterialCommand,
) {
  if (!await dependencies.persistence.touchProductIfCurrent(transaction, {
    productId: scope.product.productId,
    organizationId: scope.product.organizationId,
    currentDraftVersionId: scope.draft.productVersionId,
    expectedUpdatedAt: evidence.expectedProductUpdatedAt,
    actorId: scope.actorId,
  })) throw stale(scope.correlationId);
  if (!await dependencies.persistence.touchDraftVersionIfCurrent(transaction, {
    productVersionId: scope.draft.productVersionId,
    productId: scope.product.productId,
    organizationId: scope.product.organizationId,
    expectedUpdatedAt: evidence.expectedDraftUpdatedAt,
    actorId: scope.actorId,
  })) throw stale(scope.correlationId);
}

async function audit<Transaction>(
  dependencies: ProductMaterialsCurrentDraftDependencies<Transaction>,
  transaction: Transaction,
  scope: MutationScope,
  operation: "ADD" | "EDIT" | "REMOVE",
  changedFields?: readonly ProductMaterialEditableField[],
) {
  await dependencies.persistence.insertProductUpdatedAuditEvent(transaction, {
    organizationId: scope.product.organizationId,
    actorId: scope.actorId,
    productId: scope.product.productId,
    operation,
    ...(changedFields === undefined ? {} : { changedFields }),
    correlationId: scope.correlationId,
  });
}

function validateDraft(
  product: ProductMaterialsProductRecord,
  draft: ProductMaterialsVersionRecord,
  correlationId: string,
) {
  if (
    draft.productVersionId !== product.currentDraftVersionId
    || draft.productId !== product.productId
    || draft.organizationId !== product.organizationId
  ) throw safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", correlationId);
  if (draft.status !== "DRAFT" && draft.status !== "READY_FOR_REVIEW") {
    throw safeError("INVALID_STATE", "PRODUCT_MATERIALS_DRAFT_NOT_EDITABLE", correlationId);
  }
}

function validateCollectionOwnership(
  materials: readonly ProductMaterialRecord[],
  productVersionId: string,
  correlationId: string,
) {
  if (materials.some((material) => material.productVersionId !== productVersionId)) {
    throw safeError("INTERNAL", "PRODUCT_MATERIALS_INVARIANT_FAILURE", correlationId);
  }
}

function assertCollectionTotal(percentages: readonly (string | null)[], correlationId: string) {
  const total = percentages.reduce(
    (sum, percentage) => sum + percentageToHundredths(percentage),
    BigInt(0),
  );
  if (total > MAX_COLLECTION_HUNDREDTHS) {
    throw safeError("VALIDATION", "PRODUCT_MATERIALS_COLLECTION_INVALID", correlationId);
  }
}

function materialValues(input: ProductMaterialValues): ProductMaterialValues {
  return {
    materialName: input.materialName,
    category: input.category,
    percentage: input.percentage,
    isRecycled: input.isRecycled,
    recycledPercentage: input.recycledPercentage,
  };
}

function changedMaterialFields(
  current: ProductMaterialRecord,
  next: ProductMaterialValues,
): readonly ProductMaterialEditableField[] {
  return (["materialName", "category", "percentage", "isRecycled", "recycledPercentage"] as const)
    .filter((field) => current[field] !== next[field]);
}

function normalizeTrusted<Result>(work: () => Result, trusted: WeakSet<ApplicationError>): Result {
  try {
    return work();
  } catch (error) {
    if (error instanceof ApplicationError) trusted.add(error);
    throw error;
  }
}

function timestampFromCommand(value: string): Date {
  return new Date(value);
}

function sameInstant(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function stale(correlationId: string): ApplicationError {
  return safeError("CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE", correlationId);
}

function safeError(
  category: ApplicationError["category"],
  code: string,
  correlationId?: string,
): ApplicationError {
  const message = category === "NOT_FOUND"
    ? "The requested product or material was not found."
    : code.endsWith("STALE_WRITE")
      ? "The materials changed and must be reloaded."
      : "The material operation could not be completed.";
  return new ApplicationError(category, code, message, false, correlationId);
}

function trust(errors: WeakSet<ApplicationError>, error: ApplicationError): ApplicationError {
  errors.add(error);
  return error;
}

interface MutationScope {
  readonly product: ProductMaterialsProductRecord;
  readonly draft: ProductMaterialsVersionRecord;
  readonly actorId: string;
  readonly correlationId: string;
}
