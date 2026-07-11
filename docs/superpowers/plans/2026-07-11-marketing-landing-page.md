# Passvero Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fully localized Passvero marketing landing page with faithful desktop and mobile layouts from the supplied visual references.

**Architecture:** A localized Server Component page composes focused marketing sections. Shared primitives centralize brand styling and icons; only the mobile menu, footer disclosures, and language selector require client interactivity.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4, next-intl 4.13.2, next/image

## Global Constraints

- Use the supplied desktop, mobile, and brand-guide images as the visual source of truth.
- Do not redesign, simplify, add, remove, or reorder landing-page sections.
- No visible text may be hardcoded in components.
- Support Croatian, Serbian Latin, English, German, Slovenian, and Polish with identical message schemas.
- Prefer Server Components; use Client Components only for interaction.
- Do not add dependencies or implement authentication, dashboards, databases, QR generation, or product CRUD.
- Do not present fictional companies, testimonials, customer counts, or unsupported compliance claims.

---

### Task 1: Production visual assets and design tokens

**Files:**
- Create: `public/marketing/hero-passport.webp`
- Create: `public/marketing/dashboard-preview.webp`
- Create: `public/marketing/verification-shield.webp`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: responsive image assets and named CSS design tokens consumed by marketing components.

- [ ] Generate or derive standalone product visuals from the accepted references without embedding page UI.
- [ ] Optimize assets to WebP with stable dimensions and transparent or reference-matched backgrounds.
- [ ] Add the documented navy, blue, teal, green, slate, radius, shadow, container, focus, and motion tokens.
- [ ] Confirm the assets decode and record their dimensions.

### Task 2: Shared marketing primitives and icons

**Files:**
- Create: `src/components/marketing/marketing-icons.tsx`
- Create: `src/components/marketing/brand-logo.tsx`
- Create: `src/components/marketing/marketing-button.tsx`
- Create: `src/components/marketing/marketing-container.tsx`

**Interfaces:**
- Produces: `MarketingIcon`, `BrandLogo`, `MarketingButton`, and `MarketingContainer` with strict props.

- [ ] Implement consistent currentColor outline icons for all reference metaphors and industries.
- [ ] Implement the Passvero logo mark and wordmark as accessible code-native branding.
- [ ] Implement localized link-style button variants with the approved sizes, radii, and focus treatment.
- [ ] Implement the shared 1200px responsive container.
- [ ] Run TypeScript and ESLint.

### Task 3: Localized message schema

**Files:**
- Modify: `messages/hr.json`
- Modify: `messages/sr.json`
- Modify: `messages/en.json`
- Modify: `messages/de.json`
- Modify: `messages/sl.json`
- Modify: `messages/pl.json`

**Interfaces:**
- Produces: identical localized namespaces consumed by every marketing component.

- [ ] Define the complete Croatian source copy for Navigation, Hero, Compliance, HowItWorks, Dashboard, Industries, Benefits, CTA, and Footer.
- [ ] Translate the schema naturally into Serbian Latin, English, German, Slovenian, and Polish.
- [ ] Run a schema-parity script and require identical leaf keys across all six files.
- [ ] Run TypeScript to verify next-intl key augmentation.

### Task 4: Header and hero

**Files:**
- Create: `src/components/marketing/mobile-navigation.tsx`
- Create: `src/components/marketing/site-header.tsx`
- Create: `src/components/marketing/hero-section.tsx`

**Interfaces:**
- Consumes: shared primitives, next-intl messages, localized navigation, language selector, hero asset.
- Produces: responsive header/menu and reference-faithful first viewport.

- [ ] Build the desktop header with localized links, sign-in, locale selector, and primary CTA.
- [ ] Build the accessible mobile menu with expanded state, Escape handling, focus management, and scroll locking.
- [ ] Build the two-column desktop and stacked mobile hero with trust feature summary.
- [ ] Verify copy order, CTA stacking, visual crop, and first-viewport proportions at 375px and 1440px.

### Task 5: Compliance, process, and platform preview

**Files:**
- Create: `src/components/marketing/compliance-section.tsx`
- Create: `src/components/marketing/how-it-works-section.tsx`
- Create: `src/components/marketing/dashboard-preview-section.tsx`

**Interfaces:**
- Consumes: outline icons, localized messages, dashboard asset.
- Produces: the dark four-feature strip, responsive process timeline, and dashboard split section.

- [ ] Implement the full-width navy compliance band and centered heading accent.
- [ ] Implement the four-step horizontal flow with a vertical mobile variant.
- [ ] Implement the checklist/dashboard split with reference-aligned image framing.
- [ ] Verify German and Polish expansion does not clip or overlap.

### Task 6: Industries, benefits, CTA, and footer

**Files:**
- Create: `src/components/marketing/industries-section.tsx`
- Create: `src/components/marketing/benefits-section.tsx`
- Create: `src/components/marketing/final-cta-section.tsx`
- Create: `src/components/marketing/site-footer.tsx`

**Interfaces:**
- Consumes: outline icons, shared primitives, localized messages, shield asset.
- Produces: honest industry proof, combined conversion panel, and responsive footer.

- [ ] Implement the six-category industry row with the approved replacement heading.
- [ ] Implement the four benefit items and adjacent CTA card with faithful responsive stacking.
- [ ] Implement the desktop footer columns and native mobile disclosure groups.
- [ ] Add localized legal and social-link accessible labels without fake external destinations.

### Task 7: Page composition and visual verification

**Files:**
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: all marketing section components.
- Produces: the complete localized landing page.

- [ ] Replace the starter page with semantic section composition while preserving localized metadata and static rendering.
- [ ] Run the app and verify routes `/`, `/en`, `/de`, `/sr`, `/sl`, and `/pl`.
- [ ] Capture full-page screenshots at 1440px and 375px and inspect them alongside the accepted references.
- [ ] Keep a fidelity ledger covering hierarchy, composition, typography, palette, imagery, spacing, responsive behavior, and icon treatment; fix every material mismatch.
- [ ] Test 320, 375, 768, 1024, 1280, and 1440px for overflow and interaction behavior.
- [ ] Verify keyboard navigation, mobile menu, footer disclosures, language selector, and browser console health.
- [ ] Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`; require exit code 0 for all commands.
