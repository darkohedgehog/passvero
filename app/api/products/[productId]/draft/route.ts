import { getCreateDraftFromPublishedHttpHandler } from "@/src/infrastructure/products/create-draft-from-published-http-runtime";
export const POST = async (request: Request, context: { params: Promise<{ productId: string }> }) => {
  const { productId } = await context.params;
  return getCreateDraftFromPublishedHttpHandler()(request, productId);
};
