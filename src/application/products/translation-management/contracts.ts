import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import type { DraftTranslationContentPersistence, DraftTranslationContentProductRecord, DraftTranslationContentVersionRecord } from "../draft-translation-content/ports";
import type { TranslationContent } from "./content";

export interface TranslationRow extends TranslationContent {
  readonly id: string;
  readonly productVersionId: string;
  readonly locale: string;
  readonly updatedAt: Date;
}
export interface TranslationVersion extends DraftTranslationContentVersionRecord {
  readonly translations: readonly TranslationRow[];
}
export interface TranslationState extends DraftTranslationContentProductRecord {
  readonly currentPublishedVersionId: string | null;
  readonly draft: TranslationVersion | null;
  readonly published: TranslationVersion | null;
}
export interface TranslationEvidence {
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: string;
  readonly expectedDraftUpdatedAt: string;
}
export type TranslationCommand = TranslationEvidence & { readonly productId: string; readonly locale: string } & (
  | { readonly operation: "ADD" }
  | { readonly operation: "EDIT"; readonly translationId: string; readonly expectedTranslationUpdatedAt: string; readonly content: TranslationContent }
  | { readonly operation: "REMOVE"; readonly translationId: string; readonly expectedTranslationUpdatedAt: string }
);
export interface TranslationPersistence<Tx> extends Pick<DraftTranslationContentPersistence<Tx>, "readEligibility"> {
  readState(tx: Tx, input: { productId: string; organizationId: string; lock: boolean }): Promise<TranslationState | null>;
  touch(tx: Tx, input: { productId: string; organizationId: string; draftId: string; productAt: Date; draftAt: Date; actorId: string }): Promise<boolean>;
  add(tx: Tx, input: { draftId: string; locale: string; content: TranslationContent }): Promise<void>;
  edit(tx: Tx, input: { draftId: string; locale: string; translationId: string; expectedAt: Date; content: TranslationContent }): Promise<boolean>;
  remove(tx: Tx, input: { draftId: string; locale: string; translationId: string; expectedAt: Date }): Promise<boolean>;
  audit(tx: Tx, input: { productId: string; organizationId: string; actorId: string; operation: TranslationCommand["operation"]; locale: string; correlationId: string }): Promise<void>;
}
export interface TranslationDependencies<Tx> {
  readonly transactionRunner: { run<R>(work: (tx: Tx) => Promise<R>): Promise<R> };
  readonly persistence: TranslationPersistence<Tx>;
}
export type MutateTranslation = (command: TranslationCommand, context: AuthenticatedUserContext | null) => Promise<{ status: "ADDED" | "UPDATED" | "REMOVED" | "NO_CHANGE" }>;
export class TranslationConflict extends Error {}
