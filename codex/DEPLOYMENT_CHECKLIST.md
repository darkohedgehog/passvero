# Deployment Checklist

> Aktualni postupak i prihvaćeno stanje 1.11.2026. vodi [production runbook](../docs/superpowers/runbooks/passvero-production-release.md),
> uz [DB ugovor](../docs/runtime-database-contract.md) i [postojeći DR](../docs/superpowers/runbooks/passvero-postgresql-disaster-recovery.md).
> Release je `2eaa5a54770843828e0aae4c16f71bae4927c12b`; production/admin/controlled-onboarding
> UI prihvaćeni su u dokumentiranom opsegu. Admin notification inbox je PENDING_USER_CONFIRMATION.
> Ova generička lista nije tvrdnja da su sve stavke implementirane ili nalog da se ponove
> testovi/build/backup acceptance. Scanner/PDF, Storage-byte i pravne objave ostaju odvojeni.
> Stari pripremni plan i dodatni guardian/adapter sustav nisu važeći deployment put.

## Application

- production build passes;
- environment variables validated;
- no development-only mock data;
- no placeholder customer claims;
- error pages exist;
- not-found behavior works;
- locale routes work.

## Internationalization

- all six locales build;
- all message files share keys;
- Croatian default route works without prefix;
- language switcher preserves current route;
- localized metadata renders;
- sitemap strategy accounts for locales.

## Security

- secrets are server-only;
- authentication callback URLs are correct;
- organization authorization is enforced;
- public passports expose only intended data;
- rate limiting is configured where needed;
- upload limits are enforced;
- webhook signatures are verified.

## Database

- migrations are reviewed;
- migrations run successfully;
- indexes exist for frequent lookups;
- backup strategy exists;
- connection pooling is configured where required;
- production database URL is not exposed.

## Storage

- private and public buckets are intentionally separated;
- upload MIME and size restrictions exist;
- public document access is reviewed;
- signed URL behavior is tested.

## Observability

- application logs are available;
- errors do not expose secrets;
- health checks exist where appropriate;
- failed background/provider operations are visible.

## SEO and metadata

- production base URL configured;
- robots rules reviewed;
- sitemap generated;
- canonical URLs correct;
- language alternates correct;
- social metadata configured.

## Performance

- images optimized;
- public passport page loads well on mobile;
- no unnecessary client bundles;
- database queries reviewed;
- scan analytics does not block page rendering.

## Legal and product wording

- privacy policy present;
- terms present;
- cookie behavior reviewed;
- compliance claims are not misleading;
- analytics disclosure is accurate.
