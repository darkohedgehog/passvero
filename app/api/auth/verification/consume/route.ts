import { getExplicitAuthHttpTransport } from "@/src/infrastructure/auth/explicit-auth-http-runtime";
export const GET = (request: Request) => getExplicitAuthHttpTransport().consumeEmailVerification(request);
