import { getTranslationManagementHandler } from "@/src/infrastructure/products/translation-management-runtime";
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  return getTranslationManagementHandler()(request,(await params).productId);
}
