import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const globalStyles = fs.readFileSync("app/globals.css", "utf8");
const brandLogo = fs.readFileSync(
  "src/components/marketing/brand-logo.tsx",
  "utf8",
);
const marketingButton = fs.readFileSync(
  "src/components/marketing/marketing-button.tsx",
  "utf8",
);
const mobileNavigation = fs.readFileSync(
  "src/components/marketing/mobile-navigation.tsx",
  "utf8",
);
const aboutPage = fs.readFileSync("app/[locale]/about/page.tsx", "utf8");
const contactPage = fs.readFileSync("app/[locale]/contact/page.tsx", "utf8");
const heroSection = fs.readFileSync(
  "src/components/marketing/hero-section.tsx",
  "utf8",
);
const howItWorksSection = fs.readFileSync(
  "src/components/marketing/how-it-works-section.tsx",
  "utf8",
);

function getHexColor(token) {
  const match = globalStyles.match(
    new RegExp(`--color-${token}:\\s*(#[0-9a-f]{6})`, "i"),
  );

  assert.ok(match, `Missing --color-${token} token`);
  return match[1];
}

function relativeLuminance(hexColor) {
  const channels = hexColor
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );

  return (lighter + 0.05) / (darker + 0.05);
}

test("inverse brand logo exposes visible text without prohibited ARIA", () => {
  assert.doesNotMatch(brandLogo, /<span[^>]+aria-label=\{label\}/);
  assert.match(
    brandLogo,
    /className="text-2xl font-bold tracking-\[-0\.045em\] text-white"[\s\S]*?\{label\}/,
  );
});

test("small teal text and teal CTA backgrounds use an AA color token", () => {
  const teal = getHexColor("teal-700");
  const tealOnDark = getHexColor("teal-300");
  const navy = getHexColor("navy-950");
  const slate50 = getHexColor("slate-50");

  assert.ok(contrastRatio(teal, "#ffffff") >= 4.5);
  assert.ok(contrastRatio(teal, slate50) >= 4.5);
  assert.ok(contrastRatio(tealOnDark, navy) >= 4.5);
  assert.match(
    globalStyles,
    /\.marketing-section-label\s*\{[\s\S]*?color:\s*var\(--color-teal-700\)/,
  );
  assert.match(marketingButton, /border-teal-700 bg-teal-700 text-white/);
  assert.match(mobileNavigation, /bg-teal-700[^"\n]+text-white/);
  assert.match(aboutPage, /text-sm font-bold text-teal-700/);
  assert.match(heroSection, /block text-teal-600/);
  assert.match(howItWorksSection, /bg-teal-700 text-xs font-bold text-white/);
  assert.match(
    globalStyles,
    /\.marketing-section-label-on-dark\s*\{[\s\S]*?color:\s*var\(--color-teal-300\)/,
  );
  assert.match(aboutPage, /marketing-section-label marketing-section-label-on-dark/);
  assert.match(contactPage, /marketing-section-label marketing-section-label-on-dark/);
});
