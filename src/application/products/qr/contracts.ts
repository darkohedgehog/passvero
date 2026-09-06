import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";

export type QrStatus = "PENDING" | "ACTIVE" | "REVOKED";
export type QrFormat = "SVG" | "PNG";
export type ProductQrProjection =
  | { readonly kind: "NOT_PUBLISHED" }
  | {
      readonly kind: "QR";
      readonly status: QrStatus;
      readonly activationEvidence: string | null;
      readonly previewUrl: string | null;
      readonly downloadSvgUrl: string | null;
      readonly downloadPngUrl: string | null;
    };
export interface ActivateProductQrCommand {
  readonly productId: string;
  readonly activationEvidence: string;
}
export type QrActivationResult = { readonly status: "ACTIVATED" | "NO_CHANGE" };
export interface ProductQrArtifact {
  readonly body: Uint8Array;
  readonly contentType: "image/svg+xml; charset=utf-8" | "image/png";
  readonly filename: string;
}
export type GetProductQr = (query: { productId: string }, context: AuthenticatedUserContext | null) => Promise<ProductQrProjection>;
export type ActivateProductQr = (command: ActivateProductQrCommand, context: AuthenticatedUserContext | null) => Promise<QrActivationResult>;
export type RenderProductQrArtifact = (query: { productId: string; format: QrFormat }, context: AuthenticatedUserContext | null) => Promise<ProductQrArtifact>;
export type QrFailure = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "STALE_WRITE" | "INVALID_STATE" | "NOT_ACTIVE" | "OPERATIONAL_FAILURE";

export const QRCODE_ACTIVATED = "QRCODE_ACTIVATED" as const;
