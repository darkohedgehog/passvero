import { qrHttpFailure } from "@/src/application/products/qr/http";
import { getProductQrRuntime } from "@/src/infrastructure/products/qr-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  try {
    const { productId } = await context.params;
    return await getProductQrRuntime().http.activate(request, productId);
  } catch (error) { return qrHttpFailure(error); }
}
