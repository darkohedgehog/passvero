import { getCanonicalSitemap } from "@/src/lib/canonical-site";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";

export default function sitemap() {
  return getCanonicalSitemap(getCanonicalAppOrigin());
}
