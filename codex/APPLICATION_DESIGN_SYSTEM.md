# Passvero Application Design System

This document defines the product-interface standards for the authenticated Passvero application.

Codex must read this file before implementing or modifying authentication, onboarding, dashboards, product management, Digital Product Passport workflows, documents, QR codes, analytics, teams, settings, billing, dialogs, notifications, and responsive application behavior.

This document supplements:

- `codex/AGENTS.md`
- `codex/DESIGN_SYSTEM.md`
- `codex/ARCHITECTURE.md`
- `codex/I18N.md`
- `codex/SECURITY.md`
- `codex/TESTING.md`

The marketing design system remains the source of truth for public pages. This document is the source of truth for the authenticated application.

---

## 1. Product-interface principles

Passvero should feel calm, structured, fast, trustworthy, professional, and approachable for non-technical users.

Prioritize:

1. clear next actions;
2. incomplete product-data awareness;
3. publication state;
4. safe editing;
5. organization isolation;
6. multilingual product information;
7. predictable navigation;
8. accessibility;
9. mobile and tablet usability;
10. fast perceived performance.

Avoid:

- oversized unstructured forms;
- enterprise dashboard density;
- vanity metrics;
- unnecessary charts;
- excessive modals;
- dead navigation items;
- icon-only actions without labels;
- destructive actions near primary actions;
- unsupported compliance claims;
- dark mode in the initial release.

Use one fixed visual theme. Intentional navy surfaces may be used for navigation and emphasis.

---

## 2. Visual identity

Reuse the Passvero brand foundation:

- white and slate surfaces;
- navy application navigation;
- blue primary actions;
- teal informational accents;
- green published and success states;
- restrained shadows;
- consistent borders;
- generous whitespace;
- compact readable tables.

### Application semantic tokens

```txt
--app-background:        #F8FAFC
--app-surface:           #FFFFFF
--app-surface-subtle:    #F1F5F9
--app-sidebar:           #071827
--app-sidebar-hover:     #123047
--app-sidebar-active:    #1E3A5F
--app-border:            #E2E8F0
--app-border-strong:     #CBD5E1
--app-text:              #0F172A
--app-text-muted:        #475569
--app-primary:           #2563EB
--app-primary-hover:     #1D4ED8
--app-teal:              #0F766E
--app-success:           #15803D
--app-warning:           #B45309
--app-danger:            #B91C1C
--app-focus:             #3B82F6
```

Use shared CSS variables or Tailwind tokens. Do not scatter raw hex values across components.

---

## 3. Typography

Preferred font order:

1. Geist
2. Inter
3. system sans-serif

### Application type scale

```txt
Page title:       30px / 1.2 / 700
Section title:    22px / 1.3 / 650
Card title:       16px / 1.4 / 600
Body:             15px / 1.6 / 400
Body small:       14px / 1.5 / 400
Label:            13px / 1.4 / 600
Caption:          12px / 1.4 / 500
Table heading:    12px / 1.4 / 600
Metric:           30px / 1.1 / 700
```

Mobile page titles may use 26px and metrics 26px.

Rules:

- use sentence case;
- avoid all-caps navigation;
- keep table headings concise;
- do not use muted text for critical instructions;
- support German and Polish text expansion;
- Serbian uses Latin script;
- all visible copy uses `next-intl`.

---

## 4. Application shell

### Desktop

```txt
Sidebar expanded:   248px
Sidebar collapsed:  72px
Top header:         64px
Main max width:     1440px
Main padding:       32px
```

The shell contains:

- persistent left sidebar;
- application header;
- scrollable main content;
- optional contextual right panel.

### Tablet

- sidebar may collapse to icon-only mode;
- content padding becomes 24px;
- filters may move into a drawer;
- dense tables simplify.

### Mobile

- sidebar becomes off-canvas;
- header remains compact;
- page padding becomes 16px;
- actions stack;
- tables become cards where useful;
- no horizontal overflow.

### Content widths

```txt
Operational page:  1440px
Standard page:     1200px
Form page:          880px
Wizard:             960px
Text settings:      760px
```

---

## 5. Shell components

Recommended:

```txt
src/components/application/
├── app-shell.tsx
├── app-sidebar.tsx
├── app-sidebar-item.tsx
├── app-header.tsx
├── mobile-app-navigation.tsx
├── organization-switcher.tsx
├── user-menu.tsx
├── page-container.tsx
├── page-header.tsx
├── page-actions.tsx
├── breadcrumbs.tsx
└── app-content.tsx
```

### Sidebar navigation

```txt
Dashboard
Products
Passports
Documents
Analytics
Team
Settings
```

Hide unfinished sections. Do not show dead links.

Recommended grouping:

```txt
Passvero

Main
- Dashboard
- Products
- Passports
- Documents
- Analytics

Organization
- Team
- Settings

Footer
- Help
- Plan or Early Access state
- User menu
```

Active items use:

- background;
- icon emphasis;
- visible indicator;
- `aria-current="page"`.

Do not rely only on color.

---

## 6. Page headers

Every main page uses:

```txt
Breadcrumbs
Page title
Short description
Primary action
Secondary actions
```

Example:

```txt
Products

Manage product records and digital product passports.

[Create product]
```

Rules:

- one H1;
- primary action right aligned on desktop;
- stacked actions on mobile;
- one visually dominant action;
- short useful descriptions.

---

## 7. Dashboard

The dashboard is operational, not promotional.

### New organization state

```txt
Welcome to Passvero

You do not have any products yet.

Create your first product to start building a Digital Product Passport.

[Create first product]
```

Include:

- simple visual;
- clear CTA;
- optional onboarding checklist;
- no fake metrics or empty charts.

### Active dashboard

Recommended cards:

```txt
Total products
Published passports
Draft products
Documents requiring attention
Recent scans
Plan usage
```

Use truthful zero states.

Layout:

- 3–4 metric cards;
- recent activity;
- recent products;
- attention or onboarding card.

### Metric cards

Contain:

- label;
- primary value;
- optional supporting text;
- optional icon;
- optional destination.

Never invent trend percentages.

---

## 8. Product list

### Desktop table columns

```txt
Product
SKU
Status
Passport status
Updated
Actions
```

Optional only when useful:

```txt
Category
Language coverage
```

Product cell may include thumbnail, name, SKU, and brand.

Actions:

```txt
Open
Edit
Duplicate
Archive
Delete
```

Delete belongs in an overflow menu, not as a primary action.

### Mobile

Use cards with:

- thumbnail;
- name;
- SKU;
- statuses;
- last updated;
- primary link;
- overflow actions.

---

## 9. Search and filters

Search sits above the list.

Suggested placeholder:

```txt
Search products
```

Potential search fields:

- name;
- SKU;
- passport code;
- brand;
- category.

Initial filters:

```txt
Status
Publication status
Category
Country of origin
Updated date
```

Only implement filters backed by real data.

Active filters appear as removable chips. Include “Clear all” when appropriate. Prefer URL search parameters.

---

## 10. Data tables

Recommended shared component:

```txt
DataTable
```

Possible capabilities:

- typed columns;
- loading state;
- empty state;
- row links;
- sorting;
- pagination;
- selection only when required.

Rules:

- semantic `<table>`;
- clear headings;
- keyboard focus;
- no nested interactive row link conflicts;
- subtle separators;
- quiet hover;
- no default zebra striping;
- sticky headers only for long lists.

Responsive strategy:

1. hide low-priority columns;
2. convert to cards;
3. controlled horizontal scroll.

---

## 11. Pagination

Use operational pagination, not infinite scroll.

```txt
Previous
Page 1 of 8
Next
```

Optional:

```txt
20 per page
50 per page
100 per page
```

Keep state in URL parameters when practical.

---

## 12. Status system

Product statuses:

```txt
DRAFT
INCOMPLETE
READY_FOR_REVIEW
PUBLISHED
ARCHIVED
UPDATE_REQUIRED
```

Visible labels:

```txt
Draft
Incomplete
Ready for review
Published
Archived
Update required
```

Styling:

```txt
Draft: slate
Incomplete: amber
Ready for review: blue
Published: green
Archived: muted slate
Update required: amber or red tint
```

Always combine text, icon and color.

Published means publicly visible through a specific product version. It does not mean legally certified.

Never display unsupported labels such as:

```txt
EU approved
Officially compliant
Certified by Passvero
```

---

## 13. Product creation wizard

Use a guided wizard, not one oversized form.

Recommended steps:

```txt
1. General information
2. Identification
3. Materials
4. Documents
5. Repair and spare parts
6. Recycling and disposal
7. Preview
8. Publish
```

Recommended components:

```txt
ProductWizard
WizardStepper
WizardStep
WizardActions
WizardSummary
WizardSaveStatus
```

Behavior:

- save draft;
- validate current step before continuing;
- allow previous-step navigation;
- show completion;
- never auto-publish;
- warn on unsaved changes;
- preserve entered values on validation errors.

Desktop may use a vertical step sidebar. Mobile uses:

```txt
Step 2 of 8
Identification
```

Do not squeeze all step labels across mobile.

Save states:

```txt
Saving…
Saved
Save failed
Unsaved changes
```

Only show autosave when it exists.

---

## 14. Product form standards

Group fields:

```txt
Basic information
Identifiers
Manufacturer
Origin
Materials
Technical details
Repairability
Spare parts
Recycling
Documents
Public visibility
```

Rules:

- visibly and semantically mark required fields;
- use full width for descriptions;
- pair related short fields;
- stack on mobile;
- provide concise help text for unfamiliar concepts;
- validate with Zod;
- localize errors;
- retain valid input after failure;
- provide an error summary for long steps when useful.

---

## 15. General information

Potential fields:

```txt
Product name
Internal SKU
Brand
Category
Short description
Long description
Primary image
Manufacturer
Country of origin
```

Do not assume every organization is the manufacturer.

Support manufacturer, importer, distributor, and private-label roles.

---

## 16. Identification

Potential fields:

```txt
SKU
GTIN
EAN
Model number
Batch or lot identifier
Serial-number strategy
Passport public code
```

Only implement identifiers required by the approved domain model.

Public passport codes must be stable and non-sequential. Never expose internal database IDs.

---

## 17. Materials

Use repeatable rows or cards.

Potential fields:

```txt
Material name
Percentage
Country of origin
Recycled content
Substance notes
Additional information
```

Capabilities:

- add;
- edit;
- remove;
- reorder when relevant;
- show total percentage;
- warn above 100%.

Do not require exactly 100% unless the business rule requires it.

---

## 18. Documents

Document categories:

```txt
Manual
Certificate
Technical sheet
Warranty
Safety information
Declaration
Repair instructions
Recycling instructions
Other
```

### Upload zone

```txt
Drag and drop files here
or
Browse files
```

Support:

- file-type guidance;
- size guidance;
- progress;
- success;
- retry;
- removal;
- title;
- visibility.

Do not rely on drag and drop alone.

### Document card

Display:

```txt
Icon
Title
Type
File size
Upload date
Visibility
Actions
```

Actions:

```txt
Preview
Download
Edit details
Remove
```

Private documents never appear publicly.

---

## 19. Repair and spare parts

Potential fields:

```txt
Repairability information
Repair instructions
Repair restrictions
Spare parts available
Availability period
Service contact
Compatible replacements
Warranty information
```

Use conditional fields.

When spare parts are available, show ordering details and availability information.

---

## 20. Recycling and disposal

Potential fields:

```txt
Recycling instructions
Disposal instructions
Packaging disposal
Take-back information
Hazardous disposal notes
Material separation guidance
```

Use structured fields and free text where appropriate.

Do not generate unsupported environmental claims.

---

## 21. Preview

The preview should resemble the public passport.

Recommended component:

```txt
PassportPreview
```

Show:

- product image;
- product title;
- organization;
- origin;
- materials;
- repair information;
- recycling information;
- public documents;
- last updated;
- draft indicator.

Always display:

```txt
Preview
This passport is not public yet.
```

Optionally support mobile and desktop preview modes.

---

## 22. Publish flow

Publishing is intentional.

Checklist:

```txt
Required information completed
Public documents reviewed
Product version created
Public URL confirmed
QR code ready
```

Confirmation:

```txt
Publish product passport?

This version will become visible through the public passport URL.

[Cancel] [Publish passport]
```

After publishing show:

```txt
Passport published
Public URL
QR code
Version
Published date
```

Actions:

```txt
Open public passport
Download QR
Copy public link
```

---

## 23. Product detail

Recommended sections:

```txt
Overview
Passport data
Documents
Versions
QR code
Activity
Settings
```

Do not render unfinished tabs.

Overview includes:

- status;
- identity;
- defined completion state;
- missing information;
- current published version;
- recent updates;
- QR code;
- public link.

Prefer:

```txt
Passport readiness
8 of 10 required sections complete
```

Avoid vague “80% compliant”.

---

## 24. Version history

Preserve each published version.

Columns:

```txt
Version
Status
Created by
Created date
Published date
Actions
```

Actions:

```txt
View
Compare
Restore as draft
```

Do not overwrite historical versions.

---

## 25. QR management

Recommended component:

```txt
QrCodeCard
```

Display:

```txt
QR preview
Public URL
Passport status
Download PNG
Download SVG
Copy link
Open passport
```

Rules:

- stable Passvero URL;
- no sensitive payload;
- no internal IDs;
- adequate contrast and quiet zone;
- meaningful filenames;
- no embedded logo until scan reliability is tested.

Unpublished state:

```txt
QR unavailable
Publish the passport before using its public QR code.
```

---

## 26. Passport summary card

Display:

```txt
Passport status
Published version
Last updated
Public URL
QR preview
Actions
```

It may use a navy or emphasized surface, but must not resemble an official government certificate.

---

## 27. Documents library

Categories:

```txt
All documents
Manuals
Certificates
Technical sheets
Warranties
Safety
Other
```

Columns:

```txt
Document
Type
Products
Visibility
Uploaded
Actions
```

Document reuse may attach one file to multiple products later. Enforce organization ownership.

---

## 28. Analytics

Initial privacy-aware metrics:

```txt
Total scans
Scans by product
Recent scan activity
Country-level distribution
Device category
```

Avoid raw IP display, fingerprinting and invasive tracking.

Empty state:

```txt
No scans yet
Scan activity will appear after a published passport is opened.
```

Preferred charts:

- line for scans over time;
- horizontal bars for top products;
- simple country bars or table.

---

## 29. Team management

Roles:

```txt
Owner
Admin
Editor
Viewer
```

Table:

```txt
Member
Email
Role
Status
Joined
Actions
```

Invitation states:

```txt
Pending
Accepted
Expired
Revoked
```

The last owner cannot remove themselves without ownership transfer.

All permissions require server-side enforcement.

---

## 30. Organization settings

Potential sections:

```txt
Organization profile
Branding
Members
Domains
Data and privacy
Billing
Danger zone
```

Show only implemented sections.

Profile fields may include:

```txt
Organization name
Legal name
Website
Country
VAT number
Logo
Default language
Contact email
```

Do not expose sensitive values publicly by default.

---

## 31. User settings

Potential sections:

```txt
Profile
Language
Password or sign-in methods
Notifications
Sessions
```

Do not expose incomplete controls.

---

## 32. Billing

Plan names:

```txt
Starter
Professional
Enterprise
```

Potential future limits:

- active products;
- team members;
- storage;
- API access;
- support level.

Do not define final prices or limits without approval.

Usage card:

```txt
Products used
Storage
Team members
Current plan
Renewal date
```

Do not show billing data before billing exists.

---

## 33. Buttons

Variants:

```txt
Primary
Secondary
Outline
Ghost
Danger
Link
```

Primary actions:

- create;
- save;
- continue;
- publish;
- upload;
- invite.

Danger actions:

- delete;
- revoke;
- permanently remove.

Rules:

- 40px minimum desktop;
- 44px touch target mobile;
- visible focus;
- loading state;
- disabled state;
- prevent double submission;
- concise labels.

Loading example:

```txt
Saving…
```

Keep the label alongside an accessible spinner.

---

## 34. Form controls

Recommended:

```txt
FormField
TextInput
TextArea
Select
Combobox
Checkbox
RadioGroup
Switch
DateInput
NumberInput
CountrySelect
LanguageSelect
FileInput
TagInput
```

Input heights:

```txt
Default: 44px
Compact filter: 40px
Onboarding: 48px
```

Use native select when adequate. Use custom comboboxes only when search is necessary and keyboard behavior is correct.

---

## 35. Empty states

Structure:

```txt
Icon or illustration
Title
Short explanation
Primary action
Optional help link
```

Examples:

```txt
No products yet

Create your first product and start building a Digital Product Passport.

[Create product]
```

```txt
No documents uploaded

Add manuals, certificates or technical sheets to your products.

[Upload document]
```

Never show unexplained empty tables.

---

## 36. Loading states

Use:

- skeleton cards;
- skeleton rows;
- inline loading buttons;
- route-level loading UI.

Avoid full-screen spinners when final structure is predictable.

Skeletons should match final dimensions and avoid layout shift.

---

## 37. Error states

Errors must be localized, safe and actionable.

Examples:

```txt
We could not load your products.
Try again.
```

```txt
This product could not be found.
```

```txt
You do not have permission to edit this product.
```

Distinguish validation, not found, forbidden, provider and unknown server errors.

---

## 38. Toasts

Use for short confirmations:

```txt
Product saved
Document uploaded
Passport published
Link copied
Invitation sent
```

Do not use ephemeral toasts for errors requiring sustained user action.

Toasts must be announced accessibly.

---

## 39. Dialogs

Use for:

- confirmation;
- short focused edits;
- destructive actions;
- publication confirmation.

Do not use for long forms.

Delete example:

```txt
Delete product?

This permanently removes the draft product and cannot be undone.

[Cancel] [Delete product]
```

Requirements:

- focus trap;
- Escape handling;
- focus return;
- labelled title;
- described body;
- blocked background interaction.

---

## 40. Drawers

Use for:

- mobile filters;
- quick details;
- document metadata;
- contextual editing.

Do not place the full product wizard in a narrow drawer.

Desktop right panel:

```txt
400px–520px
```

Mobile drawer is full or near-full width.

---

## 41. Tabs

Use for peer sections inside one entity.

Example:

```txt
Overview
Documents
Versions
QR code
```

Rules:

- keyboard accessible;
- visible active state;
- major tabs use URL state;
- no nested tab systems;
- avoid more than six tabs.

---

## 42. Breadcrumbs

Use for hierarchy:

```txt
Products / Industrial Chair / Documents
```

Avoid on top-level dashboard pages and focused onboarding.

Breadcrumbs must contain real links.

---

## 43. Help and guidance

Use:

- short help text;
- tooltip;
- “Learn more” disclosure;
- contextual help card.

Avoid long legal-style instructions inside forms.

Use cautious wording:

```txt
This information may be required for your product category.
Check applicable product requirements before publishing.
```

Passvero does not provide legal certification.

---

## 44. Localization

Supported locales:

```txt
hr
sr
en
de
sl
pl
```

Croatian is default.

Rules:

- no hardcoded visible strings;
- enums map to translation keys;
- identical message schemas;
- locale-aware dates and numbers;
- EUR formatting for billing;
- no English-only plural assumptions;
- Serbian Latin;
- support German and Polish expansion.

Recommended namespaces:

```txt
AppShell
Dashboard
Products
ProductWizard
Documents
Passports
QrCodes
Analytics
Team
Settings
Billing
Common
Status
Validation
Errors
Dialogs
Toasts
```

---

## 45. Accessibility

Target WCAG 2.2 AA where practical.

Requirements:

- semantic landmarks;
- one H1;
- keyboard navigation;
- visible focus;
- valid ARIA only;
- adequate contrast;
- form labels;
- linked errors;
- accessible dialogs, menus and tables;
- reduced-motion support;
- no color-only status;
- 44px mobile targets.

Focus behavior:

- route changes move focus appropriately;
- closing dialogs and drawers returns focus;
- validation focuses first invalid field or summary;
- copied links announce success.

---

## 46. Motion

Allowed:

```txt
150–250ms transitions
opacity
small translate
small scale
drawer slide
accordion expansion
```

Avoid continuous motion, parallax and large loading animations.

Respect `prefers-reduced-motion`.

---

## 47. Responsive rules

Test:

```txt
320px
375px
390px
768px
1024px
1280px
1440px
```

Mobile:

- primary task first;
- stacked forms;
- full-width actions where appropriate;
- compact headers;
- filter drawer;
- card list views;
- no horizontal overflow.

Tablet:

- collapsible sidebar;
- two-column cards;
- readable tables;
- visible wizard navigation.

Desktop:

- persistent sidebar;
- efficient width;
- readable forms;
- strong hierarchy.

---

## 48. Performance

Prefer Server Components.

Use Client Components only for:

- interactive forms;
- menus;
- dialogs;
- drag and drop;
- live validation;
- browser APIs;
- charts.

Avoid:

- unnecessary effects;
- loading entire records into client state;
- repeated fetching;
- oversized chart libraries;
- uncontrolled images.

Use `next/image`, pagination, selective database fields, route loading UI and streaming where useful.

---

## 49. Security-informed UI

Never expose:

- internal IDs;
- private storage URLs;
- provider errors;
- tokens;
- unpublished public data;
- organization identifiers from client input;
- private user emails on public pages.

UI hiding is not authorization.

Permission examples:

```txt
Viewer
- view
- cannot edit
- cannot publish
- cannot delete
```

Enforce everything server-side.

---

## 50. Activity

Potential activity events:

```txt
Product created
Product updated
Version published
Document uploaded
Member invited
Role changed
```

Use concise human-readable entries. Do not expose infrastructure logs.

---

## 51. Shared component inventory

```txt
src/components/application/
├── app-shell.tsx
├── app-sidebar.tsx
├── app-header.tsx
├── page-container.tsx
├── page-header.tsx
├── breadcrumbs.tsx
├── page-actions.tsx
├── stat-card.tsx
├── status-badge.tsx
├── data-table.tsx
├── search-bar.tsx
├── filter-bar.tsx
├── filter-drawer.tsx
├── empty-state.tsx
├── loading-skeleton.tsx
├── error-state.tsx
├── wizard-stepper.tsx
├── wizard-actions.tsx
├── upload-zone.tsx
├── document-card.tsx
├── passport-card.tsx
├── qr-code-card.tsx
├── confirm-dialog.tsx
├── delete-dialog.tsx
├── app-toast.tsx
├── app-tabs.tsx
└── help-panel.tsx
```

Adapt to the existing repository. Do not duplicate existing components.

---

## 52. Recommended route structure

```txt
app/[locale]/
├── (auth)/
│   ├── sign-in/
│   ├── sign-up/
│   ├── forgot-password/
│   └── verify-email/
│
├── onboarding/
│   ├── welcome/
│   └── organization/
│
└── dashboard/
    ├── page.tsx
    ├── products/
    │   ├── page.tsx
    │   ├── new/
    │   └── [productId]/
    ├── passports/
    ├── documents/
    ├── analytics/
    ├── team/
    └── settings/
```

Do not create routes before the active task requests them.

---

## 53. Implementation sequence

```txt
1. Application shell
2. Authentication screens
3. Organization onboarding
4. Empty dashboard
5. Product list
6. Product wizard
7. Product detail
8. Passport preview
9. Publish flow
10. QR management
11. Documents
12. Versions
13. Analytics
14. Team
15. Settings
16. Billing
```

Do not implement later phases prematurely.

---

## 54. QA checklist

Before completing an application UI task verify:

- this design system is followed;
- all copy uses `next-intl`;
- Croatian default works;
- Serbian uses Latin;
- German and Polish fit;
- no horizontal overflow;
- keyboard navigation works;
- focus is visible;
- dialog focus returns;
- errors link to fields;
- statuses do not rely only on color;
- no fake metrics;
- no unsupported compliance claims;
- no dead navigation;
- incomplete features are not shown as functional;
- loading, empty and error states exist;
- no unnecessary Client Components;
- lint passes;
- TypeScript passes;
- tests pass;
- production build passes.

---

## 55. Final task report

For application tasks, Codex should report:

1. scope implemented;
2. files created;
3. files modified;
4. design-system components used;
5. accessibility behavior;
6. responsive behavior;
7. localization coverage;
8. authorization assumptions;
9. verification commands;
10. exact results;
11. deviations;
12. remaining work.

Do not claim completion without evidence.
