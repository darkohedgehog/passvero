import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  skipProxyUrlNormalize: true,
  // Protected image routes must never enter the public optimizer cache.
  images: { localPatterns: [{ pathname: "/marketing/**", search: "" }] },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
