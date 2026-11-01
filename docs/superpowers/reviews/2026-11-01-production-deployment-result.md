# Production Git/PM2 deployment and onboarding — accepted result

## Current accepted continuation — release 2eaa5a54770843828e0aae4c16f71bae4927c12b

The later notification release is active: app online; request-access/login HTTPS200;
exactly one production build, no npm ci or migration. BUILD_ID matched the saved private
build record; its literal value was not included in sanitized output and is not invented.
[Latest operator receipt](../../../codex/evidence/production-deployment-20261101/notification-policy-origin-review/production-activation-operator-result-20261101.json)
and [current production runbook](../runbooks/passvero-production-release.md) are authoritative.

Admin notices are enabled for zivic.darko79@gmail.com, NEW_REQUESTS, cutoff
2026-11-01T21:56:46.818Z / 1.11.2026 22:56:46.818 Europe/Zagreb. Production has its own
policy path; staging policy/recipient/cutoff were not changed. One attempt per future new
request; no retroactive dispatch, automatic resend, test message or synthetic request.
**ADMIN_EMAIL_INBOX_ACCEPTANCE=PENDING_USER_CONFIRMATION** at the next genuine request.
The backup timer is active/waiting/enabled; runtime env and Nginx were unchanged by this
last deployment. Previously accepted admin/public customer onboarding remains complete.
Scanner/PDF, Storage-byte and legal/public-feature conditions remain open in their scope.

The dated sections below describe the original transition and preparation snapshots.
Their original hashes/releases remain historical; they are not relabeled as this release.
In particular the earlier pending notification-source paragraph describes preparation,
not the current enabled configuration. No live action was performed for this doc update.

This is a result record, not a new deployment runbook or authority to rerun historical
commands. Evidence comes from user-supplied operator results and the user's UI acceptance;
the agent did not access the VPS. Public onboarding is complete and is not being reopened.

## Accepted deployment

- Production `/var/www/passvero`, branch `main`, release
  `4223f917073c170c5706e0c9f186804e9a02cd7a`. It descends from
  `73d55a28ed7a885b3f74d707bdbcc00121ee4627`; the additional change excludes the historical
  Mac-path diagnostic entry from TypeScript build inputs. Production build and six canonical
  targets were accepted. The current documentation work does not repeat that build.
- Existing startup: darko's PM2 `passvero`, `/etc/passvero/passvero-start` and
  `/etc/passvero/passvero-runtime.env`. The wrapper reloads the private runtime input on
  process startup; PM2 restart alone is not evidence of refreshed environment.
- The prepared complete 38,830-entry release tree matched accepted source/build artifacts
  before the operator switched it. Existing old tree retained at
  `/var/www/passvero.pre-aligned-release-20261101`; failed-release/history copies preserved.
- PostgreSQL `127.0.0.1:5432/passvero`: 33 finished migrations and the reviewed 70 additive
  ACL statements committed. Validator accepted 55 application tables / 56 including Prisma.
- Production profile matches UTF8, `C.UTF-8` collation/ctype and NOINHERIT for
  `passvero_app`, `passvero_auth`, `passvero_backup`, `passvero_migrator`.
  The separately documented `passvero_test` role was also pinned exactly, without changing
  production role attributes or excluding it from validation. Default ACL namespace bindings
  were aligned to observed global/public scope; no broad guard removal.
- Installed schema33 backup source SHA256:
  `ea0d0bb99386b4bea93adbfe77bd8369a3eacf43a14409c0280deaaa14f04312`.
  Backup timer was explicitly returned to active/waiting/enabled; it stayed active through
  public onboarding opening. Normal existing backup/B2/retention/alert behavior is retained.

The first pre-DDL candidate stopped on wrong C/INHERIT assumptions and was returned to
`4f1dd4e3bf0867b90cc9ad507dd5c7e5ef704ec6`, HTTPS200, without restoring or modifying the DB.
Later profile corrections preserved that failure and return history. Another ACL command
could not read root-private SQL as OS postgres; the identical reviewed SQL was subsequently
fed through stdin and committed. The validator's missing documented fifth-role expectation
was corrected against the saved catalog, not by changing roles or weakening validation.

## Recovery evidence and its limits

Final pre-migration recovery set `20261101T194430Z`, existing-job verified offsite snapshot
`2d8b587a04ac49ce995cf33214bfe3d899b317bdf8935ac17c44df19e6fecaa1` was created under the
confirmed writer hold. That point precedes subsequent customer/auth writes and cannot be
treated as a lossless rollback now. Code/config return and DB restore are separate actions;
destructive restore requires explicit review of later writes and approval of their loss.
The preliminary 34,097-entry saved disk copy is neither a runtime rollback execution nor
proof of complete host-loss recovery. No accepted recovery/backup series is repeated here.

## Admin and public onboarding acceptance

The verified Gmail admin has exactly PlatformGrant, PlatformOnboardingGrant and
PlatformBillingGrant; no regulatory/superadmin grant was added. The user confirmed login
and all three platform views. Temporary bootstrap SMTP/auth windows were closed before
the separately authorized public onboarding opening. The older admin result remains a
time-scoped snapshot, not the current SMTP or ingress state.

Public request/activation/verification/login routes and needed assets/initial dashboard
were opened without a customer operator-IP requirement. Application proxy/origin guards,
Turnstile, validation, abuse limits and authorization remain. Approval still requires the
verified admin's existing onboarding permission. Upload/document/image/reminder and other
unrelated ingress rules were not removed; this is not an assertion of unrestricted service.
Existing production transactional SMTP was enabled without new credentials.

The initial public-opening block omitted `/api/access-requests/approve`, leaving it behind
the broad API503 gate. The retained request was PENDING/NOT_STARTED/0 with no provisioned
identity/org/activation or delivery attempt. An exact POST location was subsequently added
with syntax check/reload only; no env/PM2/DB/send action occurred in that correction.

The user then confirmed approval, received activation/verification links at
`prodaja@zivic-elektro.com`, set the password through UI and signed in successfully.
This is user acceptance of that real customer flow; no synthetic submission or mail was sent
by an operator block. Independent access from an unallowlisted client IP was not observed.

## Remaining narrow change: admin email for future requests

The application still deployed at the accepted release allows automatic admin notifications
only on staging. The reviewed local change permits exactly the staging and production
canonical origins. Existing enabled settings, matching root-owned policy/recipient,
activation-time cutoff, durable outbox and first-attempt-only checks remain unchanged.
The public request is authoritative; post-commit delivery errors do not roll it back.
No old request backfill, resend, worker or test message is introduced.

Recipient: `zivic.darko79@gmail.com`. After the new code is released, activate the existing
settings row and NEW_REQUESTS policy using the actual enable time, with prior settings/policy
saved and app-readable/root-owned file permissions. Do not backdate or replay the accepted
customer request. This is configuration DML, not a schema/ACL migration. No DB restore or
migration is warranted for this delta. The next genuine request provides functional proof.

Eight focused notification/policy tests, scoped TypeScript and lint already passed.
Their persistence/SMTP doubles are not production delivery evidence. Source hashes are
pinned in the selected source manifest; unchanged source does not require rerunning them.
Commit/push require acceptance of the exact file manifest. A new production build/restart
and the settings/policy activation have been authorized for the subsequent operator phase,
but none has occurred in this manifest-review step.

## Preserved and excluded material

Guardian/new supervisor/native adapter activation and binding candidates are not the
deployment path. They remain passive/preserved locally; archiving them in Git is a separate
review. The unfinished private-profile attempt is abandoned for this path. No cleanup or
new prepare/closure is inferred. Original detailed local runbook, scripts and historical
evidence remain untouched by this documentation selection; their wholesale archival is
not part of this commit. Legal draft, roadmap, README rewrite and unrelated staging notes
remain outside the manifest. No private env/config, capability, DB dump, binary release
package or secret-bearing input is included.

Scanner/PDF, production Storage backup-byte evidence and legal/public-feature approvals
remain conditions of their corresponding opening. Customer onboarding acceptance does
not close them. Staging and the active backup timer are outside this change.

The exact proposed commit file list and content hashes are in
[commit-manifest.json](../../../codex/evidence/production-deployment-20261101/commit-manifest.json).
This result record and selected snapshots supersede their earlier pending statements only
within the explicitly accepted scopes above; old operator receipts are preserved verbatim.
