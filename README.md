# Passvero

Privatna višejezična aplikacija za strukturirane podatke o proizvodima i javne Digital Product Passport (DPP) stranice. Podržava hrvatski (bez URL prefixa), srpski, engleski, njemački, slovenski i poljski. DPP-ready opis nije jamstvo regulatorne usklađenosti ili certifikacija.

Implementirano: marketing, kontrolirani zahtjev za pristup/aktivacija/prijava, organizacijske ovlasti, proizvodi i verzije, proizvođač, GTIN/barcode i CN podaci, slike i PDF dokumenti, javni DPP i QR, pretraga te CSV import/export. Postoje privatni billing profil, ručni B2B zahtjev/ponuda/prihvat/uplata/aktivacija, kvote i odvojene platform ovlasti. Prihvaćeni PDF/scanner/reminder dokazi imaju svoj staging opseg; production otvaranje tih funkcija traži preostale dokaze i zasebna odobrenja. CSV nije potpuni izvoz organizacije; potpuno zatvaranje/brisanje i retention automatizacija nisu implementirani.

**Posljednje prihvaćeno production stanje — 1.11.2026.:** release `2eaa5a54770843828e0aae4c16f71bae4927c12b`, aplikacija online, `/request-access` i `/login` HTTP200. Završni staging UI, production prelaz i javni controlled onboarding potvrđeni su u svojim opsezima. Korisnik je završio zahtjev → admin odobrenje → aktivaciju/verifikaciju → prijavu. Gmail admin ima točno Platform, Onboarding i Billing prava, bez regulatory/superadmin prava.

Admin obavijesti su aktivne za `zivic.darko79@gmail.com`, `NEW_REQUESTS`, cutoff `2026-11-01T21:56:46.818Z` / **1.11.2026. 22:56:46.818 Europe/Zagreb**. Vrijede samo za nove zahtjeve, jedan pokušaj, bez retroaktivnog slanja ili automatskog resenda. **Prijem pri sljedećem stvarnom zahtjevu: PENDING_USER_CONFIRMATION.** Uključena konfiguracija nije inbox acceptance.

Merodavni su [postojeći production runbook](docs/superpowers/runbooks/passvero-production-release.md), [završni rezultat](docs/superpowers/reviews/2026-11-01-production-deployment-result.md) i [centralni roadmap](codex/IMPLEMENTATION_ROADMAP.md). Ovo je usklađivanje prihvaćenih operatorskih/UI dokaza, bez nove live provjere ili tvrdnje o svježini backupa.

## Stack i struktura

Next.js16 / React19 / TypeScript, next-intl, Tailwind CSS, Better Auth, Prisma7 s PostgreSQL/PrismaPg; privatni Supabase Storage adapteri i Nodemailer SMTP. Točne verzije određuju `package.json` i `package-lock.json`.

- `app/` — App Router stranice i HTTP transporti; `src/components/` — UI.
- `src/application/`, `src/domain/` — poslovni slučajevi i ugovori.
- `src/infrastructure/` — auth, persistence, storage, scanner i runtime adapteri.
- `src/i18n/`, `messages/`, `public/` — lokalizacije i asseti.
- `prisma/` — schema i immutable migracije; `tests/` — postojeće testne grupe.
- `scripts/` — specifični operatorski alati; mnogi su staging-only, nisu opće production komande.
- `codex/`, `docs/superpowers/` — projektna pravila, specifikacije, dokazi i runbookovi.

## Lokalno pokretanje

Koristiti Node/npm verzije kompatibilne s lockfileom i odobrenim release runtimeom. Ne učitavati production konfiguraciju za lokalni razvoj. Konfiguraciju osigurati kroz postojeći privatni postupak; ne kopirati tajne u README ili Git.

```bash
npm ci
npm run dev
```

`postinstall` generira Prisma client. `npm run dev` pokreće Next dev server; ne stvara bazu, ne primjenjuje migracije i ne osigurava konfiguraciju autha/scannera. Full aplikacijski tok traži odobrenu izoliranu okolinu i HTTPS origin. Runtime parser podržava samo `staging` ili `production`, nema proizvoljnog `local` moda ili DB fallbacka; ne mijenjati validatore da bi lokalni runtime pristupao produkciji.

Postojeće provjere i build komande (pokretati samo u odobrenom opsegu):

```bash
npm run lint
npx tsc --noEmit
npm run test:schema
npm run test:application
npm run test:integration
npm run test:infrastructure
npm run prisma:generate
npm run build
npm run start
```

Ne postoje generički `npm test` ni `npm run typecheck` scriptovi. Integration testovi zahtijevaju zaseban testni DB i njegove safety gateove; nikad production URL. `npm run start` poslužuje prethodno izgrađeni Next izlaz, ne provodi migracije. Gornje komande nisu pokrenute tijekom dokumentacijskog release-planning zadatka.

## Konfiguracija i okoline

Nazivi prema source parserima; vrijednosti tajni nisu dio dokumentacije. Aktualni deployment i granice povratka opisuje [production runbook](docs/superpowers/runbooks/passvero-production-release.md); [DB ugovor](docs/runtime-database-contract.md) određuje odvojene endpointove.

| Namjena | Nazivi |
| --- | --- |
| Okolina i canonical/auth origin | `NODE_ENV`, `PASSVERO_RUNTIME_ENV`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` |
| Business/auth persistence | `DATABASE_URL`, `AUTH_DATABASE_URL`; zasebna zaštićena migrator konfiguracija |
| Aktivacija i zaštita autha | `AUTH_ABUSE_HMAC_SECRET`, `AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET`, `AUTH_ACTIVATION_EMAIL_HMAC_SECRET` |
| Trusted proxy | `PASSVERO_TRUSTED_PROXY_SECRET` |
| Storage | `DOCUMENT_STORAGE_SUPABASE_URL`, `DOCUMENT_STORAGE_SUPABASE_KEY`, `DOCUMENT_STORAGE_BUCKET` |
| PDF scan | `DOCUMENT_SCAN_ENABLED`, `DOCUMENT_SCAN_CONFIG`; OS socket/health/broker pristup zaseban je preduvjet |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `AUTH_EMAIL_FROM`, `AUTH_EMAIL_REPLY_TO` |
| Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build-time javni ključ), `TURNSTILE_SECRET_KEY` (server-only) |

`BETTER_AUTH_URL` određuje i generirane canonical/hreflang/OG URL-ove i javni DPP/QR origin; mora odgovarati buildu i runtimeu. `NODE_ENV=production` nije poslovni environment selector.

| Okolina | Granica |
| --- | --- |
| Local | Razvoj i izolirani testovi prema odobrenoj konfiguraciji. Bez implicitnog pristupa VPS-u, produkcijskim podacima ili slanju. |
| Staging | `PASSVERO_RUNTIME_ENV=staging`, origin `https://staging.passvero.eu`, runtime DB `127.0.0.1:5433/passvero_acceptance`; privatni `passvero-staging-documents` i `passvero-staging-images`. Testni `passvero_test` zaseban je DB, nije staging runtime. |
| Production | `PASSVERO_RUNTIME_ENV=production`, origin `https://passvero.eu`, runtime DB `127.0.0.1:5432/passvero`; privatni `passvero-production-documents` i `passvero-production-images`, odvojeni service identiteti. U prihvaćenom prijelazu potvrđene su 33 migracije; budući release provjerava samo stvarno promijenjene uvjete. |

Runtime business role je `passvero_app`, auth provider role `passvero_auth`; migrator i backup role odvojene su. Staging build s ugrađenim originom nije production paket. Ne prenosi staging korisnike, proizvode, grantove, kampanje ili simulirane uplate. Production auth mailovi zahtijevaju odobrene primatelje/radnje; nema univerzalnog `SEND=false` env prekidača. Production notification policy je `/var/lib/passvero-production-onboarding-notifications/policy.json`; staging zadržava `/var/lib/passvero-onboarding-notifications/policy.json`. Settings, outbox i audit koriste odvojene baze. Reminder policy/campaign/timer ostaju zasebne kontrole; production reminder automatizacija nije uključena ovim prijelazom.

## Postojeći production deployment

`/var/www/passvero` → Git fast-forward na točan odobreni commit → production build s production originom i pregledanim javnim inputima → `/etc/passvero/passvero-start` → PM2 `passvero` kao `darko`. Wrapper pri startu ponovo učitava `/etc/passvero/passvero-runtime.env`; `--update-env` sam po sebi nije dokaz da je env osvježen. Prethodno se čuvaju cijelo stablo/build/dependencies i privatna konfiguracija; staging ostaje odvojen. Dokumentacijski push ne traži build/deploy.

Posljednji notification deployment imao je jedan build, bez `npm ci`, migracija ili Nginx izmjene. Backup timer ostao je **active/waiting/enabled**; staging policy i runtime env nisu mijenjani tim deploymentom. Guardian/supervisor/native adapter kandidati nisu odabrani put; pasivni materijal ostaje sačuvan, bez aktivacije ili cleanup-a.

Scanner/PDF production acceptance, Storage backup-byte pokriće i pravna objava ostaju otvoreni u odgovarajućem opsegu. Javni onboarding nije potvrda da su sve druge aplikacijske/DPP/upload funkcije javno otvorene.

## Migracije

`prisma/schema.prisma` i `prisma/migrations/` su schema ugovor. Povijesni freeze v1.0 ostaje sačuvan; kasnije odobrene migracije dio su aktualne povijesti (33 na baselineu27.10.2026.). Ne koristiti `db push`, reset, uređivanje applied SQL-a ili staging seed za production.

Migracijski postupak: read-only status i checksum usporedba → pregled pending SQL-a, podatkovne kompatibilnosti, backup pokrića i effective ACL delta → zasebno odobren migrator deploy → status/ACL provjera → kompatibilni app deploy. Postojeće Prisma CLI komande su `npx prisma migrate status` i, **samo u zasebno odobrenom execution bloku**, `npx prisma migrate deploy`. `prisma.config.ts` čita `DATABASE_URL`; za migracije ga privilegirani proces mora dobiti iz migrator konfiguracije, bez izlaganja runtimeu ili logovima. Nema automatskog lossless DB rollbacka nakon novih upisa.

## Dokumentacija za rad

- [Projektne upute](codex/AGENTS.md), [arhitektura](codex/ARCHITECTURE.md), [source pravila](codex/CODING_STANDARDS.md), [testiranje](codex/TESTING.md).
- [Centralni roadmap](codex/IMPLEMENTATION_ROADMAP.md), [production Git/build/wrapper/PM2 i povratak](docs/superpowers/runbooks/passvero-production-release.md), [opća deployment checklista](codex/DEPLOYMENT_CHECKLIST.md).
- [Runtime DB ugovor](docs/runtime-database-contract.md).
- [Production PostgreSQL DR i postojeći backup/Telegram nadzor](docs/superpowers/runbooks/passvero-postgresql-disaster-recovery.md), [noviji Stage13B runtime/ACL/backup završetak](docs/superpowers/reviews/2026-08-24-stage13b-auth-foundation-completion.md).
- [Backup coverage i prihvaćeni staging završeci](codex/EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md), [backup operatorski runbook](docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md).
- [PDF/malware ugovor](codex/DOCUMENT_MALWARE_SCAN_SCHEMA_AND_CONTRACT.md), [signature-health i recovery](codex/DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md), [qpdf execution boundary](scripts/document-scan-boundary/README.md).
- [Startup/recovery plan i shared-host granice](codex/STAGING_FULL_SERVICE_RECOVERY_AND_REBOOT_STARTUP_PLAN.md), [završni startup/PDF dokaz i granice](codex/STAGING_REPORTED_PDF_SCAN_FAILURE_TRIAGE.md).
- [Potvrđeni komercijalni ugovor](codex/SUBSCRIPTION_COMMERCIAL_CONTRACT_AND_BACKUP_SCOPE_RECONCILIATION.md), [reminder runbook](docs/superpowers/runbooks/subscription-reminders-staging.md), [future enrollment](codex/SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT.md).

Stariji checkpointi ostaju povijest; noviji datirani završeci vrijede samo za svoj dokazani opseg. Pravni nacrt je interni, zasebni rad i nije odobren za objavu. Host-loss/provider/full service recovery nije potvrđen staging startupom ili pojedinačnim korisničkim tokom.

## Licenca

Privatni repozitorij. Copyright © Živić-elektro j.d.o.o.
