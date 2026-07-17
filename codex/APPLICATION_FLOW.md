# Passvero Application Flow

This document defines the end-to-end user journey for the authenticated Passvero application.

It is the functional companion to:

- codex/AGENTS.md
- codex/APPLICATION_DESIGN_SYSTEM.md
- codex/ARCHITECTURE.md

Codex must follow these flows before implementing new application features.

---

# Guiding principles

Every workflow should:

- minimize user effort;
- expose only the information needed at the current step;
- allow saving progress;
- prevent accidental publication;
- keep the user oriented with clear progress indicators.

---

# Phase 1 – Account creation

## Entry points

- Request Early Access (public site)
- Sign up (when enabled)

Flow:

Landing Page
↓
Create account
↓
Verify email
↓
Welcome
↓
Create organization
↓
Dashboard

---

# Phase 2 – Organization onboarding

Required fields:

- Organization name
- Legal name (optional initially)
- Country
- Website (optional)
- Contact email
- Logo (optional)

After completion:

Welcome to Passvero
↓
Empty Dashboard

---

# Phase 3 – Empty dashboard

Display:

- Welcome message
- Progress checklist
- Create Product CTA

Checklist example:

☐ Create first product
☐ Complete product data
☐ Upload documents
☐ Preview passport
☐ Publish passport
☐ Download QR

---

# Phase 4 – Create product

Use a wizard instead of one long form.

Flow:

1. General Information
2. Identification
3. Materials
4. Documents
5. Repairability
6. Recycling
7. Preview
8. Publish

Rules:

- Save draft after every step.
- User may go back at any time.
- Validate before continuing.
- Never publish automatically.

---

# Step details

## 1. General

- Product name
- SKU
- Category
- Brand
- Manufacturer
- Country of origin
- Description
- Image

↓

Continue

---

## 2. Identification

- GTIN / EAN (optional)
- Model
- Passport Code (generated)

↓

Continue

---

## 3. Materials

Repeatable rows:

- Material
- %
- Origin
- Notes

↓

Continue

---

## 4. Documents

Upload:

- Manual
- Certificate
- Technical sheet
- Warranty
- Safety

↓

Continue

---

## 5. Repairability

Fields:

- Repair information
- Spare parts available
- Availability period
- Service information

↓

Continue

---

## 6. Recycling

Fields:

- Recycling
- Disposal
- Packaging
- Environmental notes

↓

Continue

---

## 7. Preview

Display:

- Mobile preview
- Desktop preview
- Public passport preview

Banner:

"This passport is still a draft."

↓

Publish

---

## 8. Publish

Checklist:

✓ Required fields completed
✓ Public documents selected
✓ Version created

Confirmation dialog:

Publish passport?

↓

Published

---

# Phase 5 – Published state

After publishing show:

- Public URL
- QR Preview
- Download PNG
- Download SVG
- Copy URL
- Open Passport

---

# Product lifecycle

Draft
↓
Ready for review
↓
Published
↓
Update required
↓
Published (new version)
↓
Archived

Never overwrite published history.

---

# Dashboard after publication

Cards:

- Products
- Published passports
- Drafts
- Documents
- Recent scans

Lists:

- Recent products
- Attention items

---

# Document flow

Upload
↓
Validation
↓
Stored
↓
Linked to product
↓
Public or Private visibility

---

# QR flow

Publish
↓
Generate QR
↓
Preview
↓
Download
↓
Print
↓
Scan
↓
Public passport

---

# Scan flow

User scans QR
↓
Public passport opens
↓
Scan recorded
↓
Analytics updated

---

# Team flow

Owner
↓
Invite member
↓
Pending
↓
Accepted
↓
Role assigned

Roles:

- Owner
- Admin
- Editor
- Viewer

---

# Future billing flow

Starter
↓
Professional
↓
Enterprise

Upgrade
↓
Confirmation
↓
Billing
↓
Updated limits

---

# Error philosophy

Every failure should explain:

- what happened;
- why;
- what the user can do next.

Never expose internal errors.

---

# Success philosophy

Every important action should end with:

- clear confirmation;
- obvious next action;
- optional shortcut.

Examples:

Product saved
→ Continue editing

Passport published
→ Open public passport

QR generated
→ Download PNG

---

# Future roadmap flows

Later additions:

- CSV import
- API access
- WooCommerce sync
- Shopify sync
- ERP integration
- GS1 interoperability

Do not implement these until explicitly requested.

---

# Canonical development order

1. Authentication
2. Organization onboarding
3. Application shell
4. Empty dashboard
5. Product CRUD
6. Wizard
7. Documents
8. Preview
9. Publish
10. QR
11. Versions
12. Analytics
13. Team
14. Settings
15. Billing
