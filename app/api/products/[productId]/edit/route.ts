import { getEditProductDraftHttpHandler } from "@/src/infrastructure/products/edit-product-draft-http-runtime";

type RouteContext = Readonly<{
  params: Promise<{ productId: string }>;
}>;

export async function POST(request: Request, context: RouteContext) {
  const { productId } = await context.params;
  return getEditProductDraftHttpHandler()(request, productId);
}
