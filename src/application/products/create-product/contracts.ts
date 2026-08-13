export interface CreateProductCommand {
  readonly initialLocale: string;
  readonly initialProductName: string;
  readonly organizationSku?: string | null;
}

export interface CreateProductResult {
  readonly productId: string;
  readonly initialProductVersionId: string;
  readonly publicCode: string;
  readonly productStatus: "ACTIVE";
  readonly draftStatus: "DRAFT";
  readonly organizationSku: string | null;
  readonly createdAt: Date;
}
