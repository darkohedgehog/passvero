# Passvero Marketing Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the existing Passvero landing page so its desktop and mobile proportions more faithfully match the approved mockups.

**Architecture:** Preserve the current Server Component section structure and make targeted Tailwind/CSS adjustments. Add only one derived logo asset; do not regenerate product visuals or change localization architecture.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript 5, Tailwind CSS 4, next-intl 4.13.2

## Global Constraints

- One fixed light marketing theme; no theme switching.
- Preserve all six locales, static rendering, accessibility, section order, and existing components.
- Do not add dependencies, sections, claims, customer evidence, or product functionality.
- Use the supplied references as the visual source of truth.

---

### Task 1: Brand asset and header

**Files:**
- Create: `public/marketing/passvero-logo.png`
- Modify: `src/components/marketing/brand-logo.tsx`
- Modify: `src/components/marketing/site-header.tsx`
- Modify: `src/components/language-switcher.tsx`
- Modify: `src/components/marketing/mobile-navigation.tsx`

- [ ] Crop the supplied logo banner non-destructively and verify its dimensions.
- [ ] Replace the approximate code-native mark with the supplied logo image.
- [ ] Tighten desktop/mobile header spacing and quiet the locale selector.
- [ ] Keep the drawer accessible and preserve current behavior.

### Task 2: Hero, compliance, process, and dashboard

**Files:**
- Modify: `app/globals.css`
- Modify: `src/components/marketing/hero-section.tsx`
- Modify: `src/components/marketing/compliance-section.tsx`
- Modify: `src/components/marketing/how-it-works-section.tsx`
- Modify: `src/components/marketing/dashboard-preview-section.tsx`

- [ ] Tighten hero spacing, typography, grid proportions, image blending, and trust alignment.
- [ ] Shorten the compliance band and make mobile items a clean vertical list.
- [ ] Correct the process connector geometry and verify numbering 1–4.
- [ ] Enlarge the dashboard and reduce section whitespace.
- [ ] Run lint and strict TypeScript.

### Task 3: Industries, CTA, and footer

**Files:**
- Modify: `src/components/marketing/industries-section.tsx`
- Modify: `src/components/marketing/benefits-section.tsx`
- Modify: `src/components/marketing/final-cta-section.tsx`
- Modify: `src/components/marketing/site-footer.tsx`

- [ ] Quiet the industry strip while retaining six localized categories.
- [ ] Rebalance benefits and CTA dimensions, spacing, buttons, and shield placement.
- [ ] Remove nonfunctional social placeholders and compact the footer.

### Task 4: Visual and production verification

**Files:**
- Create outside repository: `/tmp/passvero-refined-desktop-1440.png`
- Create outside repository: `/tmp/passvero-refined-mobile-390.png`

- [ ] Verify responsive widths and German/Polish layouts without overflow.
- [ ] Test mobile menu, footer disclosures, language switching, and browser console health.
- [ ] Capture and inspect fresh desktop/mobile screenshots against the references.
- [ ] Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`; require exit code 0.
