import { getAttachmentHandler } from "@/src/infrastructure/products/document-attachments-runtime";
import { attachmentResponse } from "@/src/application/products/document-attachments/http";
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try { return await getAttachmentHandler()(request, (await params).productId); }
  catch { return attachmentResponse("OPERATIONAL_FAILURE", 503); }
}
