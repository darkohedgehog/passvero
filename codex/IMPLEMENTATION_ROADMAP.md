# Passvero Implementation Roadmap

## Purpose

This document defines the implementation order of the entire Passvero platform.

It is the primary execution roadmap for future development.

Unlike the architecture documents, this file answers:

> What should be implemented next?

Every implementation task should follow this roadmap unless a reviewed
architectural decision explicitly changes the priority.

---

# Guiding Principles

The implementation order follows these principles:

1. Build stable foundations first.
2. Complete one vertical slice before starting another.
3. Never redesign already approved domains without an ADR.
4. Keep migrations small.
5. Keep features independently reviewable.
6. Prefer complete workflows over partially implemented modules.
7. Every completed milestone should leave the application in a deployable state.

---

# Current Status

## Database

Identity
✅ Complete

Product Domain
✅ Complete

Documents & Media
✅ Complete

Public Layer
✅ Complete

Analytics
✅ Complete

Audit
✅ Complete

Billing
✅ Complete

Platform Services
⬜ Not started

---

# Current Phase

Current milestone:

Platform Services

Current task:

Notification

---

# Completed Milestones

## Milestone 1

Identity Domain

Status

✅ Complete

---

## Milestone 2

Product Core

Status

✅ Complete

---

## Milestone 3

Product Content

Status

✅ Complete

---

## Milestone 4

Documents & Media

Status

✅ Complete

---

## Milestone 5

Public Passport

Status

✅ Complete

---

## Milestone 6

Analytics

Status

✅ Complete

---

## Milestone 7

Audit

Status

✅ Complete

---

## Milestone 8

Billing Foundation

Status

✅ Complete

---

# Remaining Milestones

## Milestone 9

Platform Services

Scope:

- Notification
- IntegrationMapping
- BackgroundJob

Status

⬜ Planned

---

## Milestone 10

Authentication

Scope:

- NextAuth configuration
- session handling
- organization switching
- protected routes

Status

⬜ Planned

---

## Milestone 11

Organization API

Scope:

CRUD for:

- Organization
- Membership
- Invitation

Status

⬜ Planned

---

## Milestone 12

Product API

Scope:

CRUD for:

- Product
- ProductVersion
- ProductTranslation
- ProductIdentifier
- ProductMaterial

Status

⬜ Planned

---

## Milestone 13

Document API

Scope:

- uploads
- associations
- image uploads
- storage abstraction

Status

⬜ Planned

---

## Milestone 14

Publishing Workflow

Scope:

- review
- publish
- withdraw
- QR generation
- Passport activation

Status

⬜ Planned

---

## Milestone 15

Analytics

Scope:

- Scan dashboard
- reporting
- charts
- exports

Status

⬜ Planned

---

## Milestone 16

Billing

Scope:

- Stripe integration
- checkout
- portal
- webhook processing

Status

⬜ Planned

---

## Milestone 17

Dashboard

Scope:

Complete authenticated application.

Status

⬜ Planned

---

## Milestone 18

Public Passport

Scope:

Public Digital Product Passport pages.

Status

⬜ Planned

---

## Milestone 19

Administration

Scope:

Internal administration.

Status

⬜ Planned

---

## Milestone 20

Production Hardening

Scope:

- performance
- monitoring
- backups
- RLS
- penetration review

Status

⬜ Planned

---

# Milestone Exit Criteria

A milestone is complete only when:

- implementation finished
- tests pass
- typecheck passes
- lint passes
- production build passes
- documentation updated
- migrations reviewed
- migrations deployed
- git committed

---

# Coding Rules

Implementation must always follow:

DATABASE_ARCHITECTURE.md

DOMAIN_RULES.md

DECISIONS.md

No implementation may redesign approved architecture.

---

# Testing Rules

Every implementation must include:

- focused tests
- regression tests
- Prisma validation
- production build

---

# Definition of Done

A task is complete only when:

- implementation
- review
- migration
- deployment
- documentation
- tests
- git commit

are all finished.

---

# Release Strategy

Prefer:

small,

reviewed,

deployable

increments.

Avoid:

large,

multi-domain,

high-risk

changes.

---

# Long-Term Vision

The long-term implementation order is:

Database

↓

Core APIs

↓

Dashboard

↓

Public Passport

↓

Billing

↓

Analytics

↓

Integrations

↓

Production Hardening

↓

Public Launch