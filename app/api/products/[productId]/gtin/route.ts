import { getGtinHandler } from "@/src/infrastructure/products/gtin-runtime";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  return getGtinHandler()(request, (await params).productId);
}
