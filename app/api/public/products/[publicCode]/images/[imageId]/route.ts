import { getImageHandlers } from "@/src/infrastructure/products/images/runtime";
import { imageHttpFailure } from "@/src/application/products/images/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ publicCode: string; imageId: string }> }) { try { const p = await params; return await getImageHandlers().download(request, p.imageId, { publicCode: p.publicCode }); } catch (error) { return imageHttpFailure(error, request.method === "HEAD"); } }
export const HEAD = GET;
