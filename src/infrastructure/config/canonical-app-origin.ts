import "server-only";
import { parseCanonicalAppOrigin } from "@/src/application/config/canonical-app-origin";

let canonicalOrigin: string | undefined;

export function getCanonicalAppOrigin(): string {
  canonicalOrigin ??= parseCanonicalAppOrigin(process.env.BETTER_AUTH_URL);
  return canonicalOrigin;
}
