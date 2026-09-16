import type { OrganizationContextRepository } from "../../application/context/resolve-authenticated-user-context";

/** An acceptance read must not silently select or repair a user's organization. */
export function readOnlyContextRepository(repository: OrganizationContextRepository): OrganizationContextRepository {
  return {
    listMembershipsForUser: userId => repository.listMembershipsForUser(userId),
    findSelection: selector => repository.findSelection(selector),
    async deleteSelection() { throw new Error("EXISTING_ORGANIZATION_SELECTION_REQUIRED"); },
    async upsertSelection() { throw new Error("EXISTING_ORGANIZATION_SELECTION_REQUIRED"); },
  };
}
