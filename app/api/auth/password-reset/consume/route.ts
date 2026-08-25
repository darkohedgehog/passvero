import { getExplicitAuthHttpTransport } from "@/src/infrastructure/auth/explicit-auth-http-runtime";
export const POST = (request: Request) => getExplicitAuthHttpTransport().consumePasswordReset(request);
