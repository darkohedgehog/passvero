# Security Rules

## Organization isolation

Every authenticated private request must derive the organization from the authenticated session.

Never trust:

- `organizationId` from form data;
- `companyId` from query parameters;
- ownership claims from the client.

All private product queries and mutations must include organization ownership checks.

## Authentication

- use secure session handling;
- do not expose session tokens;
- do not log passwords, tokens or secrets;
- hash passwords using an approved password hashing library when credentials auth is used;
- use generic authentication error messages.

## Authorization

Recommended roles:

- OWNER
- ADMIN
- EDITOR
- VIEWER

Authorization must be enforced server-side.

UI hiding is not authorization.

## Public passport security

Public passport pages may expose only fields intended for public visibility.

Never expose:

- internal database IDs unless necessary;
- private notes;
- organization billing data;
- user emails;
- storage secrets;
- unpublished versions;
- draft documents;
- internal audit logs.

## Validation

Validate:

- all mutation input;
- file metadata;
- route params;
- public passport codes;
- webhook payloads;
- query filters.

Reject unexpected fields where practical.

## File uploads

When implemented:

- use allowlisted MIME types;
- enforce file size limits;
- generate safe storage paths;
- do not trust file extensions;
- avoid public write access;
- use signed URLs where private access is required;
- scan or isolate risky file types;
- store metadata in the database.

## QR codes

QR codes must point to stable Passvero URLs.

Do not place sensitive information directly inside QR payloads.

Use a public passport code rather than internal IDs.

## Scan analytics

Avoid storing raw IP addresses when not required.

Prefer:

- irreversible IP hashing with rotating salt;
- coarse country-level information;
- minimal user-agent parsing;
- short retention where possible.

Document analytics privacy behavior.

## API and actions

- validate all input;
- return safe error messages;
- use rate limiting for public write endpoints;
- protect sensitive endpoints against abuse;
- verify webhook signatures;
- keep provider secrets server-side.

## Logging

Do not log:

- passwords;
- access tokens;
- private document URLs;
- full raw webhook secrets;
- sensitive personal information.

## Regulatory claims

The application must not generate or display unverified legal claims as facts.

Use clear status labels such as:

- Draft;
- Published;
- Data incomplete;
- Review required.

Do not label a product “EU compliant” solely because data was entered into Passvero.
