import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import type { ImageAsset, ImageCommand, ImageState } from "./contracts";
export interface ImagePersistence {
  get(productId: string, context: AuthenticatedUserContext): Promise<ImageState>;
  check(productId: string, command: ImageCommand, context: AuthenticatedUserContext): Promise<void>;
  reserve(productId: string, command: ImageCommand, context: AuthenticatedUserContext, asset: ImageAsset): Promise<void>;
  finalize(productId: string, command: ImageCommand, context: AuthenticatedUserContext, assetId?: string): Promise<void>;
  abandon(assetId: string, organizationId: string): Promise<boolean>;
  privateAsset(productId: string, imageId: string, context: AuthenticatedUserContext): Promise<ImageAsset>;
  publicAsset(publicCode: string, imageId: string): Promise<ImageAsset>;
}
