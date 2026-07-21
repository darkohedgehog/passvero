# Architectural Decisions

## ADR-001 — Multilingual from the beginning

Passvero supports:

- Croatian;
- Serbian Latin;
- English;
- German;
- Slovenian;
- Polish.

Croatian is the default locale.

URL strategy:

```txt
/       Croatian
/en     English
/de     German
/sr     Serbian
/sl     Slovenian
/pl     Polish
```

Reason:

The target market includes Croatia and other European manufacturers and importers. Adding localization later would create avoidable rework.

## ADR-002 — Next.js App Router

Use the App Router for:

- layouts;
- localized routing;
- Server Components;
- route handlers;
- metadata;
- server actions where appropriate.

## ADR-003 — PostgreSQL and Prisma

Use PostgreSQL with Prisma for structured relational product data, organizations, users, versions, documents and scans.

## ADR-004 — Product passport versioning

Published passport content must be versioned.

A product has stable identity. Passport content changes create versions.

Reason:

Historical product information and publication history must not be lost.

## ADR-005 — Stable public passport codes

Public passport pages use a non-sequential stable code.

Example:

```txt
/p/8F4KX9
```

Internal database IDs should not be used as the public identifier.

## ADR-006 — Server-side organization authorization

All private reads and writes must enforce organization ownership server-side.

Client-provided organization IDs are not trusted.

## ADR-007 — Honest compliance positioning

Passvero must not claim guaranteed legal compliance merely because a company entered product data.

Preferred positioning:

- DPP-ready;
- structured product transparency;
- support for compliance workflows.

## ADR-008

ProductVersion is the Aggregate Root
for all versioned product content.

## ADR-009

Document represents
a reusable physical asset.

ProductDocument represents
a version-specific business relationship.

## ADR-010

QRCode represents a public access point to a Passport, not to a Product.

Decision

QRCode belongs directly to Passport.

Product remains the internal business identity.

Passport remains the public representation.

QRCode represents a physical or digital access point that resolves to a Passport.

Future public entry technologies (QR, NFC, GS1 Digital Link, DataMatrix, etc.) should follow the same architectural boundary.

Consequences

* Product stays independent from public access mechanisms.
* Passport becomes the single public entry object.
* QR regeneration is simplified.
* Multiple access technologies can coexist.
* Public URLs remain attached to Passport rather than Product.
* Future QR history can evolve without redesigning Product.
