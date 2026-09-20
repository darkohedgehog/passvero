import { getImageHandlers } from "@/src/infrastructure/products/images/runtime";
import { imageHttpFailure } from "@/src/application/products/images/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) { try { return await getImageHandlers().mutate(request, (await params).productId); } catch (error) { return imageHttpFailure(error); } }
export const DELETE = POST;
