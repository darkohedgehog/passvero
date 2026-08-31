import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export interface GetProductDraftForEditQuery {
  readonly productId: string;
}

export interface ProductDraftEditFormResult {
  readonly productId: string;
  readonly productName: string;
  readonly organizationSku: string | null;
  readonly sourceLocale: string;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
  readonly expectedSourceTranslationUpdatedAt: Date;
}

export interface EditProductDraftCommand {
  readonly productId: string;
  readonly productName: string;
  readonly organizationSku?: string | null;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
  readonly expectedSourceTranslationUpdatedAt: string;
}

export interface EditProductDraftResult {
  readonly productId: string;
  readonly status: "UPDATED" | "NO_CHANGE";
}

export type GetProductDraftForEdit = (
  query: GetProductDraftForEditQuery,
  context: AuthenticatedUserContext | null,
) => Promise<ProductDraftEditFormResult>;

export type EditProductDraft = (
  command: EditProductDraftCommand,
  context: AuthenticatedUserContext | null,
) => Promise<EditProductDraftResult>;
