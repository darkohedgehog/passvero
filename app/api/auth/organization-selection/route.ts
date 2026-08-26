import { getOrganizationSelectionHandler } from "@/src/infrastructure/context/organization-context-runtime";

export const POST = (request: Request) =>
  getOrganizationSelectionHandler()(request);
