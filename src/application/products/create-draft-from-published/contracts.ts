import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export interface CreateDraftFromPublishedCommand {
  readonly productId: string;
  readonly expectedCurrentPublishedVersionId: string;
  readonly expectedProductUpdatedAt: string;
}
export interface CreateDraftFromPublishedResult {
  readonly status: "CREATED_NEW_DRAFT" | "EXISTING_DRAFT";
}
export type CreateDraftFromPublished = (
  command: CreateDraftFromPublishedCommand,
  context: AuthenticatedUserContext | null,
) => Promise<CreateDraftFromPublishedResult>;
