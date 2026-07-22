# Database Architecture Freeze v1.0

**Project:** Passvero

**Document version:** 1.0

**Freeze date:** 2026-07-22

**Status:** APPROVED

---

# Purpose

This document formally declares the completion of the first-generation Passvero
database architecture.

From this point forward the database architecture is considered stable.

Future work should extend this architecture through additive, reviewed changes
rather than redesigning existing foundations.

This document represents the official architectural contract between:

- database
- application services
- background infrastructure
- integrations
- future product development

---

# Scope

This freeze covers every implemented database domain.

## Identity

- User
- Organization
- Membership
- Invitation

## Product

- Product
- ProductVersion
- Passport

## Versioned Content

- ProductTranslation
- ProductIdentifier
- ProductMaterial

## Documents

- Document
- ProductDocument
- ProductImage

## Public Layer

- QRCode
- ScanEvent

## Infrastructure

- AuditLog

## Billing

- Plan
- Subscription

## Platform Services

- Notification
- IntegrationMapping
- BackgroundJob

Total implemented models:

**21**

---

# Implementation Summary

Current implementation consists of:

- 21 database models
- 20 enums
- 16 applied Prisma migrations
- Prisma Client 7.8.0
- complete migration history
- complete schema validation
- complete migration validation
- 149 passing automated tests

Current migration status:

Database schema is up to date.

No pending migrations.

---

# Architecture Principles

The following architectural principles are officially frozen.

## Organization Ownership

Organization remains the tenant root.

Organization-owned resources must remain explicitly owned unless deliberately
designed as inherited ownership.

---

## Product Architecture

Product represents stable identity.

ProductVersion represents immutable versioned business content.

Version-specific information belongs to ProductVersion.

Product itself must remain intentionally lightweight.

---

## Aggregate Roots

Approved aggregate roots:

- Organization
- ProductVersion
- Document
- Passport
- Plan

Children remain owned by their aggregate root.

---

## Public Passport

Public architecture remains:

Product

↓

Passport

↓

QRCode

↓

ScanEvent

This ownership chain is frozen.

---

## Documents

Document remains the reusable physical asset.

ProductDocument stores only business meaning.

ProductImage remains independent from Document.

---

## Billing

Plan represents current commercial configuration.

Subscription represents current Organization entitlement.

Subscription is NOT:

- payment history
- invoice history
- accounting ledger

Historical commercial records belong to future billing infrastructure.

---

## Platform Services

Notification

IntegrationMapping

BackgroundJob

remain persistence models.

They intentionally do NOT implement:

- delivery
- OAuth
- credentials
- worker execution
- queue implementation
- scheduler
- webhook processing

Future infrastructure extends these models without changing their
responsibilities.

---

# Approved Service Invariants

The following invariants intentionally belong to authenticated transactional
application services rather than PostgreSQL constraints.

Examples include:

- Product/ProductVersion ownership validation
- Passport ownership validation
- ProductDocument tenant validation
- publication workflow validation
- lifecycle transition validation
- Notification authorization
- Notification URL validation
- BackgroundJob normalization
- append-only repository behavior
- published-version immutability
- normalization-sensitive identity rules

These are mandatory production requirements.

They are not optional.

They are documented in:

ARCHITECTURE_DECISIONS_FROM_AUDIT.md

Future application services must implement and test every approved service
invariant.

---

# Architectural Reviews

Completed:

- Structural Integrity Audit
- HIGH Findings Review
- MEDIUM Findings Review
- Blocking MEDIUM Review
- LOW Findings Review
- Observation Review
- Documentation Synchronization
- Production Audit

No mandatory database schema blockers remain.

---

# Production Readiness

Production Audit result:

**PRODUCTION READY AFTER MINOR IMPROVEMENTS**

Production score:

**86 / 100**

Remaining work concerns operational infrastructure rather than database
architecture.

Examples:

- backup monitoring
- growth monitoring
- retention policies

No architectural redesign is required.

---

# Governance

Future schema changes must follow the established process.

Required:

1. Requirements
2. Architecture review
3. Updated documentation
4. Prisma schema
5. Migration
6. Tests
7. Deployment review
8. Documentation synchronization

Architecturally significant changes additionally require:

- ADR update

Breaking architectural redesigns require:

- new Architecture Review
- explicit approval

---

# Explicit Non-Goals

The following future work is intentionally outside this freeze:

- application services
- REST API
- Server Actions
- authentication
- authorization
- worker implementation
- scheduler implementation
- notification delivery
- provider integrations
- billing infrastructure
- reporting
- analytics aggregation

Those systems must build upon this database rather than redesign it.

---

# Freeze Outcome

The Passvero database architecture is considered:

- structurally complete
- internally consistent
- migration-complete
- documentation synchronized
- production-ready
- suitable as the long-term persistence contract for Passvero

Future work should extend this architecture through additive reviewed changes.

Breaking architectural changes require a new Architecture Review and, where
appropriate, a new ADR.

---

# Official Freeze Declaration

Database Architecture Freeze v1.0

Status:

**APPROVED**

The Passvero database architecture is hereby frozen as Version 1.0.

This document marks the completion of the database design phase and the
beginning of application-layer development.

# Acknowledgements

The database architecture was developed through an iterative engineering process
consisting of domain modeling, architecture reviews, ADRs, migration-based
implementation, automated testing, structural auditing, peer review, production
readiness assessment, and documentation synchronization.

This deliberate process was chosen to maximize long-term maintainability,
correctness, and production stability rather than short-term implementation
speed.