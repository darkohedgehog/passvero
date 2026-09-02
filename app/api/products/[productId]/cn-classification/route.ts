import { getCnClassificationHttpHandler } from "@/src/infrastructure/products/cn-classification-http-runtime";

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  return getCnClassificationHttpHandler()(request, (await params).productId);
}
