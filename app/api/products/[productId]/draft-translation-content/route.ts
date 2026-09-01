import { getDraftTranslationContentHttpHandler } from "@/src/infrastructure/products/draft-translation-content-http-runtime";
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  return getDraftTranslationContentHttpHandler()(request, (await params).productId);
}
