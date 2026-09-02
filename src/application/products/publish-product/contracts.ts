import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export interface PublishProductCommand {
  readonly productId: string;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
  readonly expectedCurrentPublishedVersionId: string | null;
}

export interface PublishProductResult {
  readonly productId: string;
  readonly status: "PUBLISHED" | "NO_CHANGE";
  readonly versionNumber: number;
}

export type PublishProduct = (
  command: PublishProductCommand,
  context: AuthenticatedUserContext | null,
) => Promise<PublishProductResult>;
