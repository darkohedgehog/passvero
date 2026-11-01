import localFont from "next/font/local";
import type { CSSProperties } from "react";

const geist0 = localFont({ src: "./geist-0.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geist1 = localFont({ src: "./geist-1.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geist2 = localFont({ src: "./geist-2.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geist3 = localFont({ src: "./geist-3.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geist4 = localFont({ src: "./geist-latin.woff2", weight: "100 900", style: "normal", display: "swap", preload: true, adjustFontFallback: false, fallback: [] });
const geistmono0 = localFont({ src: "./geist-mono-0.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geistmono1 = localFont({ src: "./geist-mono-1.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geistmono2 = localFont({ src: "./geist-mono-2.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geistmono3 = localFont({ src: "./geist-mono-3.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geistmono4 = localFont({ src: "./geist-mono-4.woff2", weight: "100 900", style: "normal", display: "swap", preload: false, adjustFontFallback: false, fallback: [] });
const geistmono5 = localFont({ src: "./geist-mono-latin.woff2", weight: "100 900", style: "normal", display: "swap", preload: true, adjustFontFallback: false, fallback: [] });

// One family per unchanged subset avoids losing glyphs when equal-weight faces overlap.
export const geistVariables = {
  "--font-geist-sans": geist4.style.fontFamily + ", " + geist3.style.fontFamily + ", " + geist2.style.fontFamily + ", " + geist1.style.fontFamily + ", " + geist0.style.fontFamily + ', "Geist W1 Fallback"',
  "--font-geist-mono": geistmono5.style.fontFamily + ", " + geistmono4.style.fontFamily + ", " + geistmono3.style.fontFamily + ", " + geistmono2.style.fontFamily + ", " + geistmono1.style.fontFamily + ", " + geistmono0.style.fontFamily + ', "Geist Mono W1 Fallback"',
} as CSSProperties;
