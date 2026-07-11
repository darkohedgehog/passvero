# Current Tasks

## Active

### 1. Configure next-intl

Required locales:

- `hr`
- `sr`
- `en`
- `de`
- `sl`
- `pl`

Requirements:

- Croatian default;
- `localePrefix: 'as-needed'`;
- localized routing;
- localized metadata;
- language switcher;
- safe locale validation;
- production build success.

### 2. Implement landing page

Use the approved Passvero desktop and mobile design references.

Requirements:

- mobile-first;
- responsive;
- localized copy;
- reusable sections;
- no fake customer claims in production;
- accessible navigation;
- no hardcoded visible text.

## Next

### 3. Add authentication

- decide Auth.js configuration;
- add sign in and sign up;
- protect dashboard;
- create organization onboarding.

### 4. Add initial Prisma schema

Entities:

- Organization;
- User;
- Membership;
- Product;
- ProductVersion;
- Material;
- Document;
- QrCode;
- ScanEvent.

### 5. Product CRUD

- create;
- list;
- view;
- edit;
- archive;
- organization authorization.

## Later

- passport publication;
- QR generation;
- file uploads;
- analytics;
- billing;
- integrations.
