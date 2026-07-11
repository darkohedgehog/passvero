# UI Guidelines

## Brand

Product name:

**Passvero**

Primary positioning:

**Digital Product Passports made simple.**

## Visual direction

The interface should feel:

- professional;
- trustworthy;
- European;
- modern;
- clean;
- accessible;
- suitable for small and medium-sized businesses.

Avoid:

- excessive gradients;
- crypto visual language;
- futuristic neon effects;
- overuse of glassmorphism;
- decorative complexity;
- generic AI imagery.

## Color direction

Recommended palette:

```txt
Navy:        #0B1D2A
Blue:        #2563EB
Teal:        #14B8A6
Green:       #22C55E
Background:  #F8FAFC
Border:      #E2E8F0
Text:        #0F172A
Muted text:  #475569
```

Use exact values only when they match the implemented design system.

## Typography

Use a clean sans-serif font.

Recommended:

- Inter;
- Geist;
- existing project font when already configured.

## Layout

- mobile-first;
- clear visual hierarchy;
- generous whitespace;
- readable line length;
- consistent container widths;
- avoid cramped dashboards.

## Components

Use:

- subtle borders;
- moderate radius;
- light shadows;
- clear focus states;
- consistent button sizing;
- meaningful empty states;
- explicit loading and error states.

## Landing page

The landing page should contain:

1. header;
2. hero;
3. trust and compliance summary;
4. how it works;
5. platform preview;
6. benefits;
7. target industries;
8. call to action;
9. footer.

Do not display fake customer logos as real customers.

If placeholder logos are used during development, label them as mock content or omit them from production.

## Mobile landing page

- single-column layout;
- stacked primary and secondary calls to action;
- hamburger navigation;
- vertical “how it works” sequence;
- full-width cards;
- compact footer accordions;
- no horizontal overflow.

## Dashboard

The dashboard should prioritize:

- products;
- passport status;
- publication state;
- missing required data;
- recent scans;
- recent documents;
- plan usage.

Avoid vanity metrics without user value.

## Public passport page

Must be optimized for mobile scanning.

Content priority:

1. product name and image;
2. verification/publication status;
3. manufacturer;
4. origin;
5. materials;
6. technical information;
7. repair and spare parts;
8. recycling;
9. documents;
10. last updated date.

## Accessibility

- semantic headings;
- keyboard navigation;
- visible focus states;
- labels for form controls;
- sufficient contrast;
- alt text for meaningful images;
- decorative images should use empty alt text;
- do not rely on color alone to communicate state.

## Responsive behavior

Test at minimum:

- 320 px;
- 375 px;
- 768 px;
- 1024 px;
- 1440 px.

Do not implement desktop-only layouts that collapse poorly.
