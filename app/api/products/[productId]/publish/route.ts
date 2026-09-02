import { getPublishProductHttpHandler } from "@/src/infrastructure/products/publish-product-http-runtime";

export const POST = async (request: Request, context: { params: Promise<{ productId: string }> }) => {
  const { productId } = await context.params;
  return getPublishProductHttpHandler()(request, productId);
};
