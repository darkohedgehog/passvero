import { executePublicDppRequest } from "@/src/application/public-dpp/http";
import { getPublicDppHttpHandler } from "@/src/infrastructure/public-dpp/public-dpp-http-runtime";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly publicCode: string }> },
) {
  const publicCode = params.then((value) => value.publicCode);
  return executePublicDppRequest(request, publicCode, getPublicDppHttpHandler);
}
