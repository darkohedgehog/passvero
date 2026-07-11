# Passvero Marketing Landing Page Design

## Design authority

The supplied brand board (`image.png`), desktop mockup (`passvero-landing.png`), and mobile mockup (`passvero-mobile.png`) are the visual source of truth. The implementation must preserve their section order, spacing hierarchy, composition, palette, typography, icon language, and responsive behavior without redesigning or simplifying the page.

## Visual thesis

A calm, trustworthy European SaaS landing page built from crisp navy typography, blue-to-teal product accents, generous white space, soft blue atmospheric backgrounds, precise outline icons, and realistic product-passport visuals.

## Information architecture

The localized page contains: a light desktop header and compact mobile navigation; a two-column hero with badge, headline, CTAs, product-passport visual, and four trust points; a full-width navy compliance strip; a four-step process; a split platform/dashboard preview; an industry strip; a combined benefits and final CTA panel; and a navy multi-column footer that becomes accessible accordions on mobile.

The mockup's fictional company proof is replaced with the approved heading “Built for manufacturers across Europe” and six neutral industry categories: Furniture, Textiles, Packaging, Electronics, Manufacturing, and Consumer Goods. The layout retains the same horizontal rhythm and does not imply current customers.

## Component architecture

`app/[locale]/page.tsx` remains a Server Component and composes focused components under `src/components/marketing/`. Static sections are Server Components. Only the mobile navigation, footer accordions, and existing language selector use client-side state. Shared button, container, brand mark, and outline icon primitives avoid duplicated styling without introducing a dependency.

## Asset strategy

The hero passport/device composition, dashboard preview, and final CTA shield are standalone optimized raster assets derived from the approved visual references. Product/UI controls and all page copy remain code-native. Images use `next/image`, explicit dimensions, responsive `sizes`, and meaningful or decorative alt behavior.

## Internationalization

Croatian is the canonical source. Identical message namespaces and keys are added to all six locale files for Navigation, Hero, Compliance, HowItWorks, Dashboard, Industries, Benefits, CTA, and Footer. Serbian uses Latin script. No visible component copy is hardcoded.

## Responsive behavior

Desktop uses a 1200px content container, two-column hero and dashboard split, horizontal process line, six-item industry row, combined benefits/CTA panel, and footer columns. Mobile uses stacked CTAs, product visual below copy, two-column trust summary, a vertically connected process, full-width dashboard preview, horizontally balanced industry grid, stacked benefit/CTA panels, a hamburger menu, and footer disclosure groups. No breakpoint may introduce horizontal scrolling.

## Accessibility and interaction

The document uses one H1 and sequential H2 headings, semantic sections and navigation landmarks, visible focus rings, 44px minimum interactive targets, labelled controls, accessible disclosure states, Escape-close behavior for the mobile menu, and reduced-motion fallbacks. Footer accordions use native `details`/`summary` behavior where possible.

## Verification

Verify all six locales, browser console health, keyboard navigation, menu behavior, language switching, and responsive widths 320, 375, 768, 1024, 1280, and 1440px. Capture desktop and mobile screenshots, compare both directly with the approved references using image inspection, fix material fidelity mismatches, then run lint, strict TypeScript, and the production build.
