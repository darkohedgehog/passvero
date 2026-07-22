# Passvero

**Status:** 🚧 Active Development

**Database Architecture:** ✅ Frozen (v1.0)

**Current Phase:** Application Services

# Passvero

Passvero is a Software-as-a-Service platform that helps manufacturers create and manage Digital Product Passports (DPP) in accordance with current and upcoming European Union regulations.

The platform enables organizations to maintain versioned product information, publish public Digital Product Passports, manage technical documentation, generate QR codes, and prepare for future integrations with ERP, PIM, and other enterprise systems.

---

## Project Status

**Current phase:** Application Services Development

### Database Architecture

✅ **Database Architecture Freeze v1.0 completed on 2026-07-22**

The database architecture has been fully designed, reviewed, implemented, tested, audited, and frozen before application-layer development.

Completed work includes:

- 21 production database models
- 20 Prisma enums
- 16 reviewed and applied Prisma migrations
- Structural Integrity Audit
- Architecture Review
- Documentation Synchronization
- Production Readiness Audit
- Database Architecture Freeze v1.0

The database now serves as the long-term persistence contract for the project.

---

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Next.js App Router
- Prisma ORM
- PostgreSQL

### Planned Infrastructure

- Background workers
- Notification delivery
- ERP integrations
- GS1 integrations
- Digital Product Passport publishing
- Analytics

---

## Repository Structure

```text
app/                    Next.js application

prisma/                 Prisma schema and migrations

tests/                  Schema and migration validation

codex/                  Architecture, ADRs and engineering documentation

public/                 Static assets
```

---

## Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Run type checking:

```bash
npx tsc --noEmit
```

Run linting:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

---

## Database

The database architecture is managed through Prisma migrations.

Never modify the production schema manually.

All structural database changes must follow the established engineering workflow:

1. Requirements
2. Architecture review
3. Documentation
4. Prisma schema
5. Migration
6. Tests
7. Review
8. Deployment
9. Documentation synchronization

Architecturally significant changes additionally require an ADR.

---

## Documentation

Project documentation is located in:

```text
codex/
```

Important documents include:

- AGENTS.md
- DATABASE_ARCHITECTURE.md
- DATABASE_ARCHITECTURE_FREEZE_v1.0.md
- ARCHITECTURE_DECISIONS_FROM_AUDIT.md
- IMPLEMENTATION_ROADMAP.md

---

## License

Private repository.

Copyright © Živić-elektro j.d.o.o.