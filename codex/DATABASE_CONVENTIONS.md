# Database Conventions

This document defines the database implementation standards for Passvero.

Unlike `PRISMA_DOMAIN_MODEL.md`, this document does not define business entities.

Instead, it defines **how the database should be designed and implemented**.

Every Prisma model should follow these conventions.

Whenever implementation details conflict with this document, the implementation should be updated unless a documented architectural decision exists.

---

# Goals

The database should be:

- readable
- predictable
- explicit
- migration-safe
- scalable
- testable

Consistency is more important than personal preference.

---

# General Principles

The database should express the domain.

It should not merely store data.

Schema readability is a feature.

Future developers should understand the schema without reading application code.

---

# Naming Conventions

## Models

Use:

PascalCase

Examples:

Product

Organization

Passport

Never:

Products

Organizations

tblProduct

---

## Fields

Use:

camelCase

Examples:

createdAt

updatedAt

organizationId

publicCode

Never:

created_at

OrgID

product_id

---

## Relations

Relation fields describe the relationship.

Examples:

organization

product

versions

documents

Avoid abbreviations.

---

## Foreign Keys

Always end with:

Id

Examples:

organizationId

productId

userId

Never:

organization

owner

organizationID

---

## Relation Names

Whenever multiple relations exist between the same models:

Always specify explicit Prisma relation names.

Never rely on generated relation names.

---

# Primary Keys

Every entity uses:

UUID

Never integer IDs.

UUID generation should be centralized.

---

# Public Identifiers

Public identifiers are separate from primary keys.

Examples:

publicCode

slug

Never expose UUIDs publicly unless explicitly intended.

---

# Timestamps

Every major entity contains:

createdAt

updatedAt

Additional timestamps only when meaningful.

Examples:

publishedAt

archivedAt

acceptedAt

withdrawnAt

Do not add timestamps "just in case."

---

# Soft Delete

Soft delete is not the default.

Use soft delete only when:

business recovery is required.

Otherwise:

Archive

or

Hard Delete

depending on business rules.

---

# Archive

Archive is preferred over soft delete for historical entities.

Examples:

Product

Document

Organization

Archive preserves business history.

---

# Hard Delete

Allowed only when:

No published history exists.

No protected relations exist.

User has permission.

Operation is confirmed.

---

# Decimal

Always use Decimal for:

percentages

currency

measurements requiring precision

Never Float.

---

# String

Business identifiers remain String.

Examples:

GTIN

EAN

SKU

Passport Code

Leading zeros must be preserved.

---

# Boolean

Use booleans only for true binary state.

Examples:

isPrimary

isArchived

Avoid many boolean flags representing workflow.

Workflow belongs to enums.

---

# Enum Usage

Use enums for:

Status

Role

Visibility

Lifecycle

DocumentType

Avoid enums for:

Countries

Materials

Categories

These may evolve.

---

# JSON Usage

JSON is allowed only when:

the structure is intentionally flexible.

Examples:

Audit metadata

Notification metadata

BackgroundJob payload

Avoid JSON for relational business data.

---

# Arrays

Avoid PostgreSQL arrays for business relationships.

Prefer relational tables.

---

# Relation Design

Every relation must answer:

Who owns it?

Can it exist alone?

Can it be deleted?

Should it cascade?

---

# Cascade Rules

Cascade only for dependent child entities.

Examples:

Draft Materials

Draft Translations

Draft ProductDocuments

Avoid cascade for aggregate roots.

---

# Restrict Rules

Prefer Restrict over Cascade.

Historical data should survive.

---

# Set Null

Use SetNull when:

actor deletion

optional ownership

historical references

Examples:

publishedBy

updatedBy

archivedBy

---

# Index Strategy

Every index must have a reason.

Questions:

What query uses it?

How often?

Does it improve filtering?

Avoid speculative indexes.

---

# Composite Indexes

Design according to query patterns.

Not according to table structure.

---

# Unique Constraints

Prefer business uniqueness.

Examples:

publicCode

slug

organizationId + sku

Avoid artificial uniqueness.

---

# Partial Indexes

Partial indexes belong in SQL migrations.

Not Prisma schema.

Document every manual migration.

---

# Migrations

One concern.

One migration.

Examples:

Create Product

Create Version

Create Documents

Avoid huge migrations.

---

# Seed Data

Seed only development data.

Never seed production examples.

Never seed fake compliance data.

---

# Row Level Security

Every tenant table must support:

organizationId

RLS should filter by organization.

Never by UUID alone.

---

# Serialization

Prisma models are persistence objects.

Never return Prisma models directly.

Always map:

Entity

↓

DTO

↓

API

---

# DTO Naming

Examples:

ProductDto

PassportDto

OrganizationDto

Avoid:

ProductResponse2

DataObject

---

# Repository Rules

Repositories:

Persistence only.

No validation.

No permissions.

No business logic.

---

# Service Rules

Services enforce:

Permissions

Transactions

Business rules

Versioning

Publication

Repositories do not.

---

# Transaction Rules

Use transactions for:

Publish

Invite

Archive

Ownership transfer

Subscription updates

Avoid long-running transactions.

---

# Background Processing

Long-running work belongs to jobs.

Examples:

QR generation

Imports

Exports

Image processing

Analytics aggregation

---

# Testing

Every schema change should verify:

Migration

Rollback

Seed

Prisma Generate

Application Build

---

# Performance

Optimize after measuring.

Never before.

Readability is preferred until profiling indicates otherwise.

---

# Documentation

Every manual migration should explain:

Why it exists.

What problem it solves.

Whether Prisma supports it.

---

# Future Compatibility

The schema should support:

Supabase

PostgreSQL

Prisma upgrades

Future integrations

Without redesign.

---

# Code Review Checklist

Before approving any schema change verify:

✓ Naming follows conventions.

✓ Ownership is explicit.

✓ Delete behavior defined.

✓ Indexes justified.

✓ Relations named.

✓ UUID used.

✓ Decimal where needed.

✓ No business logic in Prisma.

✓ DTO mapping planned.

✓ RLS compatible.

✓ Migration documented.

✓ Tests updated.

---

# Final Principle

The database is a long-term asset.

Every schema decision should prioritize:

Correctness

↓

Consistency

↓

Maintainability

↓

Performance

Never sacrifice long-term architecture for short-term convenience.