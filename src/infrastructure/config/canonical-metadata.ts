import "server-only";
import { createLocalizedMetadata as createMetadata } from "@/src/lib/seo";
import { getCanonicalAppOrigin } from "./canonical-app-origin";

export function createLocalizedMetadata(input: Parameters<typeof createMetadata>[0]) {
  return createMetadata(input, getCanonicalAppOrigin());
}
