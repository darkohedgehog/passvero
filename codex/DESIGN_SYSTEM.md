# Passvero Design System

This document defines the visual and interaction standards for Passvero.

Codex must read this file before implementing or modifying:

- the marketing website;
- authentication pages;
- onboarding;
- the dashboard;
- product management;
- public product passport pages;
- pricing;
- settings;
- responsive navigation;
- shared UI components.

The approved Passvero desktop, mobile and brand-reference mockups are the visual source of truth for the marketing website.

Do not redesign the approved interface unless the active task explicitly requests a redesign.

---

## 1. Design principles

Passvero should feel:

- professional;
- trustworthy;
- modern;
- European;
- clear;
- calm;
- practical for small and medium-sized businesses.

The interface should communicate:

- product transparency;
- verification;
- structured data;
- compliance readiness;
- security;
- reliability.

Avoid:

- crypto-style visuals;
- neon effects;
- excessive glassmorphism;
- overly decorative gradients;
- dense enterprise dashboards;
- generic AI imagery;
- fake certification badges;
- visual claims that imply official EU approval.

---

## 2. Design authority

For the marketing website, use the approved references as the design specification:

- desktop landing-page mockup;
- mobile landing-page mockup;
- Passvero brand board.

When implementing or modifying the landing page:

- follow the approved mockups as closely as practical;
- preserve section order;
- preserve spacing hierarchy;
- preserve visual balance;
- preserve the brand palette;
- preserve responsive behavior;
- do not invent extra sections;
- do not remove approved sections;
- do not substitute a different visual style.

If implementation constraints require a deviation, document it in the final task report.

---

## 3. Brand identity

### Product name

**Passvero**

### Primary descriptor

**Digital Product Passports**

### Preferred positioning language

Use wording such as:

- Digital Product Passports made simple.
- Create, manage and publish trusted product passports.
- DPP-ready product data management.
- Structured product transparency for modern businesses.

Avoid unsupported claims such as:

- officially EU certified;
- guaranteed EU compliance;
- 100% compliant;
- legally approved by the EU.

---

## 4. Color system

Use CSS variables or Tailwind theme tokens rather than scattering raw hex values throughout components.

### Core palette

```txt
--color-navy-950:   #071827
--color-navy-900:   #0B1D2A
--color-navy-800:   #123047

--color-blue-600:   #2563EB
--color-blue-500:   #3B82F6
--color-blue-100:   #DBEAFE

--color-teal-600:   #0F9F91
--color-teal-500:   #14B8A6
--color-teal-100:   #CCFBF1

--color-green-600:  #16A34A
--color-green-500:  #22C55E
--color-green-100:  #DCFCE7

--color-slate-950:  #0F172A
--color-slate-700:  #334155
--color-slate-600:  #475569
--color-slate-500:  #64748B
--color-slate-300:  #CBD5E1
--color-slate-200:  #E2E8F0
--color-slate-100:  #F1F5F9
--color-slate-50:   #F8FAFC

--color-white:      #FFFFFF
```

### Semantic tokens

```txt
--background:             var(--color-white)
--background-muted:       var(--color-slate-50)
--background-dark:        var(--color-navy-950)

--foreground:             var(--color-slate-950)
--foreground-muted:       var(--color-slate-600)
--foreground-on-dark:     var(--color-white)

--primary:                var(--color-blue-600)
--primary-hover:          #1D4ED8
--secondary:              var(--color-teal-500)
--success:                var(--color-green-500)

--border:                 var(--color-slate-200)
--border-strong:          var(--color-slate-300)
--focus-ring:             var(--color-blue-500)
```

### Color usage

Use blue for:

- primary calls to action;
- active navigation;
- important links;
- selected states.

Use teal for:

- secondary emphasis;
- product-passport visual accents;
- process steps;
- section labels;
- supportive highlights.

Use green for:

- valid or published status;
- positive confirmation;
- successful verification;
- completed actions.

Do not use green to claim legal or regulatory compliance.

Use navy for:

- footer;
- compliance-oriented feature strips;
- dashboard sidebars;
- strong contrast sections.

---

## 5. Typography

Use the existing project font when already configured.

Preferred font families:

1. Geist
2. Inter
3. system sans-serif fallback

Recommended stack:

```css
font-family:
  Geist,
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

### Type scale

```txt
Display XL:  64px / 1.05 / 700
Display L:   56px / 1.08 / 700
Display M:   48px / 1.10 / 700

Heading 1:   44px / 1.10 / 700
Heading 2:   36px / 1.15 / 700
Heading 3:   28px / 1.20 / 700
Heading 4:   22px / 1.25 / 650

Body L:      18px / 1.65 / 400
Body M:      16px / 1.60 / 400
Body S:      14px / 1.55 / 400
Caption:     12px / 1.45 / 500
```

### Mobile type scale

```txt
Heading 1:   38px / 1.08 / 700
Heading 2:   30px / 1.15 / 700
Heading 3:   24px / 1.20 / 700
Body L:      17px / 1.60 / 400
Body M:      15px / 1.60 / 400
```

### Typography rules

- Keep body text widths readable.
- Prefer `max-width: 60ch` for longer copy.
- Do not use all caps for long text.
- Small section labels may use uppercase with increased tracking.
- Use bold sparingly for emphasis.
- Maintain visible heading hierarchy.
- Never reduce font size solely to force content into a fixed-height card.

---

## 6. Spacing system

Use a consistent 4px base scale.

```txt
1:   4px
2:   8px
3:   12px
4:   16px
5:   20px
6:   24px
8:   32px
10:  40px
12:  48px
16:  64px
20:  80px
24:  96px
28:  112px
32:  128px
```

### Section spacing

Desktop:

```txt
Small section:   64px vertical
Standard:        96px vertical
Large:           120px vertical
Hero:            96px to 128px vertical
```

Mobile:

```txt
Small section:   40px vertical
Standard:        56px vertical
Large:           72px vertical
Hero:            48px to 64px vertical
```

Do not compress major landing-page sections to save space.

---

## 7. Layout and containers

### Main content widths

```txt
Marketing max width:    1200px
Wide visual max width:  1320px
Dashboard max width:    1440px
Text content max width: 720px
```

Recommended container pattern:

```txt
width: 100%
margin-inline: auto
padding-inline:
  16px mobile
  24px tablet
  32px desktop
```

### Grid

Desktop landing sections may use:

- 12-column grid;
- 2-column 5/7 or 6/6 splits;
- 4-column feature rows;
- 3-column cards where appropriate.

Mobile must collapse to one column unless a compact 2-column feature grid is explicitly supported by the approved design.

### Breakpoints

Use the project Tailwind breakpoints unless already customized.

Target verification widths:

```txt
320px
375px
768px
1024px
1280px
1440px
```

No horizontal scrolling is allowed.

---

## 8. Border radius

Use moderate, consistent rounding.

```txt
Small controls:      8px
Buttons:             10px
Inputs:              10px
Cards:               16px
Large cards:         20px
Hero mockup panels:  24px
Pills:               999px
```

Avoid using a different radius on every component.

---

## 9. Shadows

Use shadows lightly.

### Suggested shadows

```css
--shadow-sm:
  0 1px 2px rgb(15 23 42 / 0.05);

--shadow-md:
  0 8px 24px rgb(15 23 42 / 0.08);

--shadow-lg:
  0 18px 50px rgb(15 23 42 / 0.12);

--shadow-float:
  0 24px 70px rgb(15 23 42 / 0.16);
```

Use stronger shadows mainly for:

- hero device mockups;
- dashboard previews;
- floating QR cards;
- important modal surfaces.

Do not apply heavy shadows to every card.

---

## 10. Buttons

### Primary button

Use for:

- Book a demo;
- Create passport;
- Publish;
- Save primary action;
- Get started.

Style:

```txt
background: blue-600
text: white
hover: blue-700
height: 44px to 48px
padding-inline: 20px to 24px
radius: 10px
font-weight: 600
```

### Secondary button

Use:

```txt
background: white
border: slate-300
text: slate-950
hover background: slate-50
```

### Teal action

Use only where it matches the approved visual reference, mainly:

- selected mobile CTA treatment;
- product-passport accent actions;
- supportive actions.

### Button rules

- Minimum touch target: 44px.
- Use visible focus rings.
- Include icons only when they add meaning.
- Keep labels concise.
- Avoid more than two competing CTA styles in one section.
- On mobile, hero CTA buttons should stack and use full width.
- Disabled buttons must remain legible.

---

## 11. Forms

### Inputs

```txt
height: 44px to 48px
border: slate-300
radius: 10px
background: white
focus border: blue-500
focus ring: blue-100
```

### Form rules

- Always display visible labels.
- Placeholder text is not a replacement for labels.
- Show errors near the relevant field.
- Use localized validation messages.
- Do not hide required-field meaning behind color alone.
- Group related fields into logical sections.
- Use progressive disclosure for complex passport forms.
- Avoid extremely long single-page forms.

---

## 12. Cards

### Standard card

```txt
background: white
border: slate-200
radius: 16px
padding: 24px
shadow: none or shadow-sm
```

### Highlight card

```txt
background: subtle blue or teal tint
border: matching soft accent
radius: 20px
padding: 28px to 32px
```

### Dark card

Use navy backgrounds for:

- trust;
- security;
- interoperability;
- scalability;
- compliance workflow explanations.

Use white text and blue/teal icon accents.

### Card rules

- Keep content hierarchy clear.
- Do not overload cards with more than one primary action.
- Match card heights only when content remains readable.
- Avoid decorative elements that compete with content.

---

## 13. Icons

Preferred icon style:

- simple line icons;
- consistent stroke width;
- rounded joins;
- no mixed icon families in the same interface.

Use icons for:

- scan;
- verify;
- trace;
- documents;
- security;
- compliance workflow;
- analytics;
- products;
- materials;
- repair;
- recycling.

Recommended approach:

- use an existing lightweight icon package already installed;
- otherwise use inline SVG components;
- do not add a large icon package only for a few icons.

Icon sizes:

```txt
Inline:        16px
Button:        18px
Card:          24px
Feature:       28px to 36px
Hero badge:    40px to 48px
```

---

## 14. Imagery and mockups

Use:

- optimized product UI mockups;
- realistic dashboard previews;
- product-passport mobile screens;
- QR code cards;
- product images;
- subtle device framing.

Avoid:

- misleading screenshots presented as production data;
- fake compliance seals;
- fake customer evidence;
- copyrighted brand assets without permission;
- embedding important text inside images when it should be HTML.

Use `next/image` when appropriate.

Provide meaningful alt text for informative images.

Use empty alt text for decorative visuals.

---

## 15. Header and navigation

### Desktop

The marketing header should include:

- Passvero logo;
- Product;
- Solutions;
- Pricing;
- Resources;
- About;
- language selector;
- sign-in link;
- primary CTA.

Keep the layout visually light.

### Mobile

Use:

- logo;
- hamburger button;
- accessible menu drawer or panel;
- locale selector;
- primary CTA.

The mobile menu must:

- trap focus when implemented as a modal;
- close with Escape;
- close after route navigation;
- expose correct expanded state;
- avoid background scrolling while open.

---

## 16. Landing-page section standards

### Hero

Must include:

- concise badge;
- strong headline;
- one highlighted phrase;
- supporting paragraph;
- primary CTA;
- secondary CTA;
- product-passport visual;
- trust feature summary.

Desktop:

- text and mockup in two columns.

Mobile:

- single column;
- stacked CTA buttons;
- visual below CTA;
- trust items in a compact grid or list.

### Dark trust strip

Use a navy background.

Include:

- product-readiness messaging;
- secure-by-design;
- interoperability;
- scalability.

Do not claim official compliance certification.

### How it works

Desktop:

- horizontal four-step flow.

Mobile:

- vertical step flow.

Steps:

1. Create
2. Generate
3. Share
4. Verify

### Platform preview

Use a split section:

- benefit copy and checklist;
- dashboard preview.

On mobile:

- text first;
- preview below;
- no tiny unreadable dashboard text.

### Trusted companies

Do not show invented companies as real customers in production.

Use one of these approaches:

- remove the section until real customers exist;
- label the logos as example industries;
- replace it with “Built for manufacturers across Europe” and industry categories;
- use clearly marked placeholder content only in development.

### Benefits

Show:

- build trust;
- reduce risk;
- improve efficiency;
- unlock value.

### CTA

Use one strong card with:

- clear headline;
- concise supporting text;
- primary action;
- secondary action;
- no-credit-card or setup messaging only when true.

### Footer

Desktop:

- multi-column layout.

Mobile:

- accordion groups;
- brand summary;
- legal links;
- language selector if useful.

---

## 17. Dashboard standards

The dashboard should prioritize useful operational information.

Primary navigation:

- Dashboard;
- Products;
- Passports;
- Documents;
- Analytics;
- Team;
- Settings.

Prioritized dashboard content:

- total products;
- published passports;
- drafts requiring attention;
- missing required information;
- recent scans;
- document status;
- plan usage.

Avoid:

- decorative metrics;
- fake percentage growth;
- dense tables without filters;
- unnecessary charts.

---

## 18. Public product passport standards

The public passport page must be mobile-first because most users will arrive via QR scan.

Recommended order:

1. product image;
2. product name;
3. passport/publication status;
4. manufacturer;
5. product identifier;
6. origin;
7. materials;
8. technical characteristics;
9. repairability;
10. spare parts;
11. recycling and disposal;
12. documents;
13. last updated;
14. issuer/company information.

Use clear section cards and accessible accordions when content is long.

Do not display internal notes or private company data.

Do not display “verified” unless the status has a defined meaning in the application.

---

## 19. Status language

Recommended statuses:

- Draft
- Incomplete
- Ready for review
- Published
- Archived
- Update required

Use semantic styling:

```txt
Draft:              slate
Incomplete:         amber
Ready for review:   blue
Published:          green
Archived:           slate
Update required:    red or amber
```

Do not use:

- EU approved;
- officially compliant;
- certified by Passvero;

unless a real, defined certification process exists.

---

## 20. Motion

Motion should be subtle.

Allowed:

- 150–250ms hover transitions;
- small button and card elevation;
- accordion expansion;
- mobile menu transitions;
- gentle hero mockup entrance;
- reduced-motion alternatives.

Avoid:

- constant floating animations;
- parallax that harms readability;
- large scroll-jacking effects;
- delayed content visibility;
- motion required to understand content.

Respect `prefers-reduced-motion`.

---

## 21. Accessibility

Minimum requirements:

- semantic HTML;
- correct heading hierarchy;
- keyboard access;
- visible focus states;
- sufficient contrast;
- labels for controls;
- descriptive button text;
- accessible navigation;
- accessible accordions;
- no color-only meaning;
- reduced-motion support;
- meaningful image alt text.

Target WCAG 2.2 AA where practical.

---

## 22. Responsive rules

### Mobile-first implementation

Start from the smallest layout and progressively enhance.

### Mobile

- single-column content;
- full-width primary controls;
- stacked hero CTAs;
- vertical process steps;
- simplified navigation;
- footer accordions;
- minimum 16px body text where practical;
- no horizontal overflow.

### Tablet

- allow 2-column feature grids;
- retain comfortable touch targets;
- avoid shrinking desktop layouts into unreadable forms.

### Desktop

- preserve generous spacing;
- use wider visual compositions;
- keep text columns readable;
- avoid stretching paragraphs across the full page.

---

## 23. Tailwind implementation rules

- Prefer semantic reusable components.
- Avoid repeating long class strings across multiple files.
- Use `cn()` or the existing class merge helper where available.
- Do not create arbitrary values for every spacing decision.
- Use theme tokens for colors, radius and shadows.
- Keep responsive classes readable.
- Do not add global CSS for styles that belong to a component.
- Use global CSS for tokens, base styles and truly shared behavior.

---

## 24. Component expectations

Recommended marketing components:

```txt
src/components/marketing/
├── site-header.tsx
├── mobile-navigation.tsx
├── hero-section.tsx
├── trust-strip.tsx
├── how-it-works-section.tsx
├── platform-preview-section.tsx
├── industries-section.tsx
├── benefits-section.tsx
├── final-cta-section.tsx
└── site-footer.tsx
```

Recommended shared components:

```txt
src/components/ui/
├── button.tsx
├── container.tsx
├── section-heading.tsx
├── badge.tsx
├── card.tsx
└── icon-wrapper.tsx
```

Adapt to the current project. Do not duplicate existing components.

---

## 25. Internationalization and layout

All visible copy must come from `next-intl`.

Design must support text expansion in:

- German;
- Polish;
- Slovenian;
- Serbian;
- Croatian;
- English.

Do not use fixed-width text boxes that only fit English.

Do not hardcode line breaks unless required by the approved headline composition and safe across locales.

Where highlighted words differ by language, structure translation messages so emphasis remains semantically correct.

---

## 26. Quality checklist

Before completing a UI task, verify:

- the implementation follows the approved reference;
- no visible text is hardcoded;
- all supported locales render;
- German and Polish text do not break layouts;
- there is no horizontal overflow;
- mobile navigation is keyboard accessible;
- headings are hierarchical;
- buttons have visible focus states;
- images are optimized;
- no fake customer or compliance claims were added;
- no unnecessary Client Components were introduced;
- lint passes;
- TypeScript passes;
- production build passes.

For visual tasks, report any deviations from the approved mockups.