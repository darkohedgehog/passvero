import { getManufacturerHandler } from "@/src/infrastructure/products/manufacturer-runtime";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  return getManufacturerHandler()(request, (await params).productId);
}
