import { qrHttpFailure } from "@/src/application/products/qr/http";
import { getProductQrRuntime } from "@/src/infrastructure/products/qr-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  try {
    const { productId } = await context.params;
    return await getProductQrRuntime().http.artifact(request, productId, "PNG", false);
  } catch (error) { return qrHttpFailure(error); }
}
