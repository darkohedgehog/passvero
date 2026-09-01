import { getProductMaterialsHttpHandler } from "@/src/infrastructure/products/product-materials-http-runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  return getProductMaterialsHttpHandler()(request, (await params).productId);
}
