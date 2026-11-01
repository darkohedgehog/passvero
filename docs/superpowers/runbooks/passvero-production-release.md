# Passvero — production Git/build/wrapper/PM2 runbook

## Authority and last accepted state — 1 November 2026

This is the current production deployment entry point. It describes the existing
Git checkout, build and startup mechanism; it does not authorize a new deployment.
The [accepted deployment result](../reviews/2026-11-01-production-deployment-result.md)
and [latest notification operator receipt](../../../codex/evidence/production-deployment-20261101/notification-policy-origin-review/production-activation-operator-result-20261101.json)
are authoritative within their stated scope. They are supplied operator/user evidence,
not a fresh agent VPS observation. Earlier receipts retain their original release/hash/time.

| Item | Last accepted value |
| --- | --- |
| Production | `/var/www/passvero`, branch `main` |
| Release | `2eaa5a54770843828e0aae4c16f71bae4927c12b` |
| Startup | darko PM2 `passvero`, wrapper `/etc/passvero/passvero-start` |
| Runtime source | `/etc/passvero/passvero-runtime.env`, private loader input |
| Runtime | online; `/request-access` and `/login` HTTPS200 |
| Build | one build, no npm ci; BUILD_ID matched private build record |
| Backup timer | active / waiting / enabled |
| Database | 33 completed migrations, reviewed70 additive grants; schema33 validator accepted |
| Admin | verified Gmail; exactly Platform, Onboarding and Billing grants; three UI views accepted |
| Controlled onboarding | real request → admin approval → activation/verification → password login accepted |
| Admin notice | enabled for `zivic.darko79@gmail.com`, mode `NEW_REQUESTS` |
| Cutoff | `2026-11-01T21:56:46.818Z` = 1.11.2026 22:56:46.818 Europe/Zagreb |
| Inbox acceptance | **PENDING_USER_CONFIRMATION**, next genuine new request |

The notification deployment did not change runtime env, Nginx or staging policy.
The literal BUILD_ID was not returned in sanitized output; do not invent it or copy an
older build ID into this release. Configuration/readiness is not evidence of inbox receipt.
No synthetic request, test mail, historical backfill or automatic resend was performed.

## Existing deployment mechanism

`/var/www/passvero` → exact approved Git fast-forward → production build with reviewed
production origin/public inputs → existing wrapper → only PM2 `passvero` as `darko`.
Production and staging folders/processes/configuration are separate. Do not infer a
staging filesystem path from the production path or restart staging during production work.

Before a separately authorized change, use only the needed mutable preconditions:
correct checkout/branch/head, clean source/index, exact release scope, startup target,
private configuration identity, resources and any affected DB/config state. Divergence,
local changes or a conflicting destination mean STOP; no force/reset/rebase/merge fallback.
Preserve the whole compatible old source/build/public/dependency/Prisma-client tree and
private configuration with ownership, permissions and symlinks intact. Never copy an
actively changing `.next` cache and claim an automatically consistent recovery package.

Use the existing Git origin and reviewed SSH alias, without displaying remote credentials.
Fetch the exact approved release and use fast-forward only. Install dependencies only
when the reviewed dependency delta requires it; package/lock/schema equality and retained
installed dependencies justified skipping npm ci for the last notification release.
A documentation-only push requires neither build nor deployment.

Build with `BETTER_AUTH_URL=https://passvero.eu`, the reviewed public Turnstile input and
existing production build method. Do not expose runtime DB/SMTP/storage/auth secrets to
build argv/logs. Do not reuse a staging-origin build. One approved source deployment means
one build; failures retain private logs and use explicit continuation or return, not retry.

`/etc/passvero/passvero-start` sources the private runtime input on every application
startup. A named PM2 restart must invoke that existing wrapper; `--update-env` alone does
not establish that all variables refreshed. The accepted blocks compare the effective
process environment privately. Do not rewrite PM2 saved state or use a new supervisor.
Postchecks stay limited to release/build identity, named process/port, startup errors,
policy/config result, HTTPS and any specifically affected DB result. User UI acceptance
is separate and must be explicitly reported by the user.

The [complete notification deployment/return blocks](../../../codex/evidence/production-deployment-20261101/notification-policy-origin-review/PRODUCTION-DEPLOYMENT.md)
are retained as the executed, dated procedure for this release. Their original REVIEW ONLY
wording records the preparation phase; subsequent operator receipts establish execution.
They expect old HEAD4223 and exclusive destinations: **do not replay them against the
current production release or treat them as commands for a future change**.

## Configuration and notification isolation

[Runtime DB contract](../../runtime-database-contract.md): production
`127.0.0.1:5432/passvero`, staging `127.0.0.1:5433/passvero_acceptance`.
Business/auth roles are `passvero_app`/`passvero_auth`; migrator and backup are separate.
Production uses UTF8, `C.UTF-8` collation/ctype and the documented NOINHERIT role attributes.
Do not change locale, inheritance, credentials or endpoint to satisfy a candidate profile.
Existing explicit grants and the established connection contract supply required access.

| Origin | Policy file |
| --- | --- |
| `https://passvero.eu` | `/var/lib/passvero-production-onboarding-notifications/policy.json` |
| `https://staging.passvero.eu` | `/var/lib/passvero-onboarding-notifications/policy.json` |
| Other/missing origin | rejected before filesystem access |

There is no production fallback to staging policy. The production policy is root-owned,
app-readable and not writable by the app; directory0750/file0640 root:darko were admitted
by the actual reader. Existing root ownership, permissions, non-symlink/O_NOFOLLOW, size,
strict schema, matching-recipient, cutoff and first-attempt checks remain.
`OnboardingNotificationSettings`, notification outbox and delivery/audit rows live in the
selected environment's DB. Production recipient/cutoff activation did not alter staging.

Only a new request after the cutoff may cause one automatic admin notice. Duplicate
submission does not resend or provision; request persistence is authoritative and delivery
failure does not roll it back. DELIVERY_UNKNOWN remains for explicit reconciliation,
never automatic resend. There is no new worker, reminder campaign or catch-up scan.
The next real request/inbox confirmation is the remaining functional acceptance;
do not generate a fake request or replay the accepted customer to obtain that evidence.

## Existing backup and practical return

Use the [PostgreSQL DR runbook](passvero-postgresql-disaster-recovery.md) for database
recovery and the existing backup job/locks/valid-offsite evidence. The active timer and
normal B2/retention/failure-alert behavior remain unchanged. No backup acceptance series
is requested by this documentation update. Active timer status is not a fresh offsite
receipt or full host-loss proof. Production Storage backup-byte scope is separate.

Last notification preservation: `/var/www/passvero.before-admin-notifications-20261101`
and private state `/var/lib/passvero-admin-notifications-deploy-20261101`.
Return stops only the named app, preserves failed/partial material, restores the entire old
compatible tree and the prior notification settings/policy, then starts the existing wrapper.
It does not mix old source with new `.next`, public assets or node_modules. Runtime env and
Nginx were not modified by that deployment and are guarded rather than blindly overwritten.
Requests, identities, notification delivery evidence and audit are retained; a code/config
return cannot undo a real message already sent. The latest preservation is not itself
proof that this runtime return was executed.

Earlier migration transition recovery point `20261101T194430Z`, snapshot
`2d8b587a04ac49ce995cf33214bfe3d899b317bdf8935ac17c44df19e6fecaa1`, predates subsequent
accepted auth/customer writes. It is a historical pre-migration point, **not a lossless
rollback now**. Code/config return and DB recovery are distinct. After schema/ACL changes,
do not assume old-code compatibility. Before any destructive DB restore, establish later
writes, prevent new ones and obtain explicit approval of any loss using the existing DR
procedure. There were no schema/ACL changes in the final notification deployment.

## Historical failures and nonselected infrastructure

The original detailed runbook and old preparation plan were preserved byte-identically
under local `codex/evidence/production-deployment-20261101/documentation-alignment/history/`,
outside the proposed Git set. Their original hashes and classification are recorded in
[the documentation manifest](../../../codex/evidence/production-deployment-20261101/documentation-alignment/manifest.json).
This is traceability, not deletion or wholesale archival of executable candidates.

Keep the following distinctions from the accepted history:

- The first candidate assumed C/INHERIT; production was C.UTF-8/NOINHERIT. The pre-DDL
  return restored the old code/config with HTTPS200 and no DB restore. Production was
  not changed to fit the faulty profile; later namespace/fifth-role bindings were qualified.
- Root-private ACL SQL was unreadable to OS postgres via a filename; the identical reviewed
  70-grant SQL was later fed through stdin and committed. No broad grant expansion followed.
- Initial public opening omitted the approve endpoint; a single exact POST location fixed
  that gate. The retained request was then approved and the customer completed the UI flow.
- Notification policy initially shared staging's path; the released exact-origin reader
  now isolates production without changing staging recipient/cutoff.

Guardian/new supervisor/native adapter activation/binding gates are not the deployment
path. Installed passive paths and source/proof candidates remain preserved, not activated,
upgraded, deleted or routinely closed. The private-profile attempt is abandoned for this
path; saved cancellation/closure evidence is history, not authority to prepare again.
The saved installation receipts concretely name preserved passive source versions
`/usr/local/libexec/passvero-production-env/bundle-0433ce053fa19e659d271de9bd77c7c5152025ac132bc2f67331d98903bc2b1a`
and `/usr/local/libexec/passvero-production-entry/bundle-f2bde1389f66a33cd2ca42783bc1a8adce0121922f032e32780182d905096334`.
These are historical installed-version identities, not a fresh inventory or selected runtime.
Later attempt/cancellation receipts stay local and must not be relabeled as current activation.
No new active blocker/resource requiring closure was established by this documentation
review. W1/W2, migration, ACL and recovery proofs remain useful historical evidence, not
substitutes for the checks required by a future concrete production operation.

## Open scope

- Admin notification inbox: **PENDING_USER_CONFIRMATION** at the next genuine new request.
- Production scanner/PDF functional acceptance and relevant public/upload opening.
- Production Storage backup-byte coverage.
- Reviewed legal publication and the existing separate legal decisions.
- Broader host-loss/provider recovery remains NOT_PROVEN; do not conflate it with the
  accepted application/onboarding deployment or request another blanket acceptance series.

These items do not reopen completed admin/customer onboarding. No new task, deployment,
message, cleanup or acceptance series is authorized by this runbook's documentation update.
