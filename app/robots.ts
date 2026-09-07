import { getCanonicalRobots } from "@/src/lib/canonical-site";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";

export default function robots() {
  return getCanonicalRobots(getCanonicalAppOrigin());
}
