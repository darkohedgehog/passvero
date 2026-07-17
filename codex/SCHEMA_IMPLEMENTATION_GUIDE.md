# Schema Implementation Guide

This document explains how Codex should translate the architectural documentation into `schema.prisma`.

The architecture has already been designed.

Codex must not redesign it.

---

# Source Documents

The following documents are authoritative.

Read them in this order.

1.

PROJECT_CONTEXT.md

↓

2.

APPLICATION_FLOW.md

↓

3.

APPLICATION_DESIGN_SYSTEM.md

↓

4.

DOMAIN_RULES.md

↓

5.

PRISMA_DOMAIN_MODEL.md

---

No architectural decisions should contradict these documents.

---

# Goal

Generate a production-ready Prisma schema.

The generated schema should:

- compile
- migrate
- support PostgreSQL
- support Supabase
- support Row Level Security
- support future expansion

The schema should prioritize correctness.

---

# Development Order

Generate models in this order.

1.

Organization

2.

User

3.

Membership

4.

Invitation

5.

Product

6.

ProductVersion

7.

ProductTranslation

8.

ProductIdentifier

9.

ProductMaterial

10.

Document

11.

ProductDocument

12.

ProductImage

13.

Passport

14.

QRCode

15.

ScanEvent

16.

AuditLog

17.

Subscription

18.

Plan

19.

Notification

20.

IntegrationMapping

21.

BackgroundJob

This order minimizes relation conflicts.

---

# Relation Strategy

Always use explicit Prisma relation names.

Never rely on automatic relation names.

Especially for:

Product

↓

ProductVersion

where three different relations exist.

---

# Ownership

Every Organization-owned entity should contain:

organizationId

unless ownership is inherited intentionally.

Never trust client ownership.

---

# UUID Strategy

Every primary key uses UUID.

No integer IDs.

---

# Naming

Model names:

Singular

PascalCase

Field names:

camelCase

Enums:

PascalCase

Enum values:

UPPER_SNAKE_CASE

---

# Relation Names

Always name relations.

Examples:

ProductVersions

CurrentDraftVersion

CurrentPublishedVersion

Never leave Prisma to infer them.

---

# Delete Rules

Every relation must explicitly specify:

onDelete

onUpdate

Never rely on Prisma defaults.

---

# Indexes

Implement:

single indexes

compound indexes

unique constraints

Do not implement partial indexes inside Prisma.

Instead:

Create SQL migrations.

---

# Manual SQL Migrations

Expected examples:

One active draft.

One primary image.

Future:

One active membership.

Document every manual migration.

---

# Decimal Types

Use Decimal for:

percentages

future pricing

Never Float.

---

# String Types

Identifiers remain String.

Examples:

GTIN

EAN

SKU

Passport Code

Leading zeros matter.

---

# JSON Fields

Use JSON sparingly.

Only for:

Audit metadata

Notification metadata

BackgroundJob payload

Never Product content.

---

# Versioning

Published ProductVersion must be immutable.

Schema should support this.

Business logic enforces it.

---

# Transactions

Document transaction boundaries.

Publication

Invitation

Ownership transfer

Archive

Subscription update

These belong to Services.

---

# DTO Strategy

Schema models are persistence.

Never expose them directly.

Public API

↓

DTO

↓

Serializer

---

# Validation

Prisma validates structure.

Business validation belongs to Services.

Do not overload Prisma with business rules.

---

# RLS

Keep every tenant table compatible with:

Supabase Row Level Security.

Organization ownership should be explicit.

---

# Testing

After schema generation:

Run:

Prisma validate

↓

Prisma generate

↓

Migration

↓

Seed

↓

Type generation

↓

Application build

No schema should be considered finished before all succeed.

---

# Expected Deliverables

Codex should generate:

schema.prisma

↓

migration

↓

seed

↓

ER explanation

↓

manual SQL migrations

↓

implementation report

---

# Final Principle

Codex should implement.

Not redesign.

Whenever uncertainty appears:

Return to

DOMAIN_RULES.md

or

PRISMA_DOMAIN_MODEL.md

Architecture is already complete.