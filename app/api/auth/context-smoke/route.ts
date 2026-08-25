import { getContextSmokeHandler } from "@/src/infrastructure/context/organization-context-runtime";

export const GET = (request: Request) => getContextSmokeHandler()(request);
