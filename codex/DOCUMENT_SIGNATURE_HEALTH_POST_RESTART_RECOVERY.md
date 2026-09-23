# Signature-health post-restart recovery — 2026-09-23

Final status: staging recovery A/B **PASS**; authenticated private PDF smoke C
**PASS**; exact storage cleanup **PASS**, audit **RETAINED**, acceptance window
**CLOSED**. Malware-scanning readiness is proven for this bounded staging run.
Reboot acceptance, long-running unattended operation and earlier unrelated
NOT_PROVEN statuses remain **NOT_PROVEN**. Historical sections below retain the
sequence of stops and corrections; their pending statuses are superseded by this final result.
Source base: `main`, `5b9e4625baa104622b2c29a6ec70c50d36429633`; initial index/worktree clean.
Dashboard remains `qwLCXFTd9EEGdvqaB9SZS`. No application deployment, migration, commit or push.

## Confirmed cause and chosen route

The operator's root read-only preflight reported `PRIVATE_INPUT_REQUIRED` at COLLECT.
`freshclam.conf` retained its approved SHA-256 but was owned by UID 108, whereas the
producer requires root ownership for configuration. Why ownership changed is not proven.
The retained updater log also contains two initialization boundaries (September 22 and
23), so ownership correction alone cannot restore trust. Installed ClamAV is 1.5.4;
the producer previously accepted only 1.5.3 VERSION grammar.

Retained `daily.cld` has no independently established fresh-base validation history after
this boundary. In upstream 1.5.4 `cli_cvdload`, archive digital-signature verification is
conditional on CVD, not CLD. A CLD hash, VERSION, `sigtool` success or up-to-date message
cannot supply the missing premise. The selected route uses a fresh official CVD set in
a separate directory, under the existing confined Freshclam service. Its `getcvd`
verifies the downloaded archive before the successful updated result; TestDatabases
adds a load test, not the authenticity premise. Existing FIPS/trust-root settings remain.

Reviewed primary sources:
- [ClamAV 1.5.4 CVD verification](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/libclamav/cvd.c)
- [Official download verification and updated result](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/libfreshclam/libfreshclam_internal.c)
- [Updater cooldown and ordered update loop](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/libfreshclam/libfreshclam.c)
- [Freshclam load callback](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/freshclam/freshclam.c)

## Recovery contract and operator entry point

After checksum-reviewed installation, the single entry point is:

```sh
sudo /usr/bin/python3 -I -B \
  /usr/local/libexec/passvero-signature-recovery-v3/recover.py recover \
  --id "recovery-$(date -u +%Y%m%d%H%M%S)"
```

This is the entry point after a later restart, not an instruction to run again now.
Use a new unique ID for a later recovery. Run only after identifying the consumers and
reviewing the unchanged pinned configuration/package/confinement. The implementation
pins this staging hostname, release, identities and reviewed ClamAV binaries; a changed
pin stops before service mutations and requires review, not bypassing the guard.

1. Root-owned persistent `flock` excludes competing recovery operations. The lock inode
   is never removed. Durable phase intent precedes each mutating step.
2. Disable/stop the producer timer, let any producer finish within a bounded wait, and
   refuse an outstanding producer lock. Move an existing snapshot into the root archive.
   Stop the updater, daemon and its socket; reject any remaining UID 108 writer.
3. Copy original configurations, producer, active databases and complete logs into a
   private root-owned archive with exact SHA-256 and ownership/mode metadata. No old
   database or log is deleted. The sequence counter is never reset.
4. Create `db/recovery-<id>` and separate `updater/recovery-<id>.log` and
   `daemon/recovery-<id>.log`. Preserve `freshclam.dat` cooldown state. Change only database
   and log path directives; correct updater config ownership to root. Update the producer
   config's paths and exact updater-config hash; install the reviewed producer bundle.
5. Start the existing confined Freshclam service once. Require the same live PID,
   expected account/cgroup and enforced AppArmor profile. Observe a bounded fresh CVD
   download. Errors, warnings, cooldown or timeout stop; no manual download retry.
6. Start the existing daemon/socket against the new directory and verify confinement.
   The same updater remains alive, preserving the initial evidence period. The existing
   parent-directory database condition in the clamd unit is satisfied by the preserved
   original files; no systemd/AppArmor path expansion is needed for these child paths.
7. Enable the existing 15-second timer. The existing producer alone performs strict
   evidence validation and atomic publication. Require actual staging-reader acceptance
   of three consecutive increasing sequences: initial publication plus two scheduled
   calls. Persist minimized observations and an accepted snapshot as root-only evidence.

The independent reader probe runs as UID/GID 1001 with the existing socket group, uses
`createSignatureHealthProvider` and the private reader, and performs no scan/DB operation.
No policy 2 semantics, expiry/freshness, scanning decisions, delivery rules, capabilities,
AppArmor profiles or resource limits change. Root remains the trusted administrator.

## Failure, interruption and rollback

An ordinary exception contains the operation: timer disabled, current snapshot moved
out of its reader path, updater/daemon/socket stopped. A failed attempt is not silently
retried. A killed process releases the OS lock; its durable incomplete state requires
explicit rollback. Re-entering that ID contains the attempt and returns
`INTERRUPTED_REQUIRES_ROLLBACK`. Another ID cannot bypass an unresolved attempt.

A completed ID is read-only/idempotent: it returns `ALREADY_RECOVERED` only if current
pins, epoch, updater identity and reader still validate. It never changes timestamps or
publishes on replay. An expired or changed period requires a new reviewed recovery.

Concrete rollback (same installed script, retained archive):

```sh
sudo /usr/bin/python3 -I -B \
  /usr/local/libexec/passvero-signature-recovery-v3/recover.py rollback \
  --id recovery-20260923-03
```

Retained archive for accepted attempt 03: `/var/lib/passvero-signature-trust/records/recovery/recovery-20260923-03/`.
Rollback verifies saved hashes, restores original configuration and producer bytes and
metadata, and restarts the old updater/daemon/socket. **The producer timer stays disabled**:
rollback preserves fail-closed scanning, not obsolete HEALTHY evidence. New candidate
files and all logs/journals remain retained. Repeated rollback is a no-op. If containment
cannot settle a producer or a retained lock is present, STOP; never remove the lock by
assumption. Its owner/process state requires inspection. No automatic database restore.

## Scope of live service interruption

The preflight observed socket group 988 with only `passvero-staging` as member and only
staging PM2/application processes as non-root consumers. Freshclam and clamd run as
UID 108 under existing enforced profiles. The recovery interrupts these existing
Freshclam/clamd services and socket; it does not restart PM2, the dashboard, qpdf or
production. This is current observed consumer scope, not historical/exhaustive proof.

## Final evidence and remaining limits

Local:
- 13 Python operator tests PASS (final v3), covering: phase failure containment, incomplete attempt, concurrency,
  idempotency, explicit rollback, reader rejection, preserved old bytes/cooldown, and
  isolated configuration path replacement.
- 61 relevant TypeScript parser/producer/private-reader/application-scan tests PASS.
- Strict 1.5.3 and 1.5.4 acceptance; unknown version and duplicate initialization reject.
- TypeScript and scoped ESLint PASS. Webpack build PASS with explicit public `BETTER_AUTH_URL=https://staging.passvero.eu`.
- Turbopack was blocked by local port binding restrictions, including the escalated attempt.
  Webpack initially required the missing canonical public URL; the corrected invocation passed.
  No environment file or credentials were changed.

Staging, supported by operator outputs and the real browser flow:
- A recovery/install: PASS, attempt `recovery-20260923-03` COMPLETE.
- B actual HEALTHY + staging reader + two further scheduled publications: PASS,
  sequences 38169–38171 and later accepted 38181.
- C real-session private PDF upload → explicit scan → CLEAN/policy 2 → authorized
  identical-byte download: PASS. Exact sealed-receipt cleanup PASS; audit retained.
- Dashboard build `qwLCXFTd9EEGdvqaB9SZS` and recovered application runtime unchanged.
- Producer recovery PASS; staging malware-scanning readiness proven for this run.
- Reboot acceptance and long-running unattended continuity: NOT_PROVEN.
- Earlier unrelated EICAR/PDF/OOM/socket/CSV/recovery NOT_PROVEN statuses unchanged.

A successful producer recovery is not the PDF smoke. A successful PDF smoke is not a
new malware-detection acceptance series or production authorization. No unattended
rebootstrap was added. Rotation/restart, package/config changes or lost history still
fail closed and require this explicit reviewed operator path.

## Prepared operator package

Durable VPS path: `/home/darko/passvero-signature-recovery-5b9e462`.
Package checksum-manifest SHA-256: `5880435bff91c9842619fdb449079db97f33f89714b7cf6f020f74e4d1139cd1`.
Producer bundle SHA-256: `725d3494983cfce68bdcacd30f9078606aa6c87c4b9d12a5674ea3770da7464b`.
Installation is additive; `install.py` rejects a different existing installed package.
The installed recovery tool has the fixed path shown above. Its source review maps
changed execution inputs to this source base, separately from final documentation.

## First operator execution — recovery stopped

The operator verified package manifest `5880435bff91c9842619fdb449079db97f33f89714b7cf6f020f74e4d1139cd1`.
Installation PASS; recovery returned `STOP / SCANNER_IDENTITY_CHANGED`.
No successful health publication or scan acceptance is claimed.
Fresh read-only systemd inspection confirmed: Freshclam failed with MainPID 0,
ExecMainCode 1 / ExecMainStatus 2; clamd inactive with MainPID 0; producer timer
inactive/disabled. Freshclam is configured as `Type=simple`, `User=clamav`, `Group=clamav`.
The immediate process-identity assertion can observe the pre-exec startup interval,
but the exact observed UID was not retained, so that causal attribution remains
unconfirmed. No recovery retry, identity bypass, service configuration change or
rollback has been performed. A bounded root read-only inspection is pending to
verify the durable phase, backup integrity, absent snapshot and normalized log reasons.
Staging recovery and PDF smoke remain NOT_PROVEN; scanning readiness remains NOT_READY.

## Confirmed startup defect and v2 correction

Operator read-only inspection confirmed phase `updater`, all 12 backup hashes intact,
no health snapshot/producer lock, and no new updater log. Freshclam journal recorded
UID 108 and CONFIG_READ_ERROR. The new root-owned config was mode 0400: `os.open`
filtered requested 0444 through recovery's umask 077. This also affected other explicitly
requested non-private modes. `atomic` now fchmods the open descriptor after ownership
assignment and before fsync/rename, including rollback writes. Regression covers
0444, 0644, 0640 and 0600 under umask 077.

The earlier SCANNER_IDENTITY_CHANGED observation itself did not retain the observed
UID; its attribution to the pre-exec interval remains an inference. The immediate check
was nevertheless incompatible with Type=simple startup semantics. v2 waits at most
five seconds for the actual executable, then enforces the same four UID values,
AppArmor profile and cgroup. A root-running Freshclam is rejected, not accepted by
waiting; only the known systemd executor/pre-exec transition is waited out. Failure
and timeout remain fail-closed. Process capture checks executable/PID/UID stability.
Reference: https://github.com/systemd/systemd/blob/main/man/systemd.service.xml

Ten operator tests PASS after reproducing the umask failure first. TypeScript,
producer/reader bundles, application build and policy are unchanged; prior checks reused.
The revised installer targets `/usr/local/libexec/passvero-signature-recovery-v2`,
retaining v1. Use v2 to roll back `recovery-20260923-01` (correctly preserving saved
modes), then recover with new ID `recovery-20260923-02`. All previous candidate files,
logs, configs and evidence stay retained. No attempt is resumed by deleting its journal.

v2 remote package: `/home/darko/passvero-signature-recovery-5b9e462-v2`.
Package checksum-manifest SHA-256: `2f1c4f1345bf54fc7127b3e94b8d1bf59970ba39b37c663b55a31e52ba3903ac`.
Pending operator execution; recovery and authenticated PDF smoke are not yet PASS.

## Second operator result and v3 readiness correction

v2 installation PASS; attempt 01 rollback ROLLED_BACK_FAIL_CLOSED. Attempt 02 stopped
with PRODUCER_REJECTED. The operator's existing producer journal proves
`UNTRUSTED / DAEMON_UNAVAILABLE / VERSION`. Read-only service inspection confirmed
timer inactive and updater/daemon inactive with MainPID 0. No successful recovery or
PDF smoke is claimed. The exact daemon loading state at rejection remains subject
to the conditional read-only guard below; VERSION unavailability alone does not prove it.

The source started the timer after process confinement, without waiting for database
load completion or socket readiness. v3 fixes this independently established ordering
defect: same daemon/updater PID, no daemon errors, Loaded-signatures log record, and a
bounded real zVERSION response are required before timer activation. The readiness
window is at most 120 seconds with two-second individual socket probes. These are
startup-only read-only probes, not scans, producer runs or HEALTHY publications.
The producer's own five-second deadline, two-second VERSION timeout, and all policy
freshness/expiry limits are unchanged. Startup refusal/exit/invalid response fails closed.

13 operator tests PASS, including delayed readiness, timeout, failure propagation,
read-only command bytes and invalid VERSION rejection. No changed TypeScript or
producer/reader bundle; previous TS tests/build evidence reused.

Before any v3 installation/service mutation, `verify-stop.py` must confirm the existing
attempt-02 scheduled phase, intact backups, stopped services, absent snapshot/lock,
exact journal reason, no daemon failure/error, and no completed database load at the
recorded producer failure time. Otherwise STOP with no mutation. This distinguishes
the supported startup ordering fix from a different daemon/socket problem.

After that guard: install v3 alongside retained v1/v2, use its explicit rollback for
attempt 02, then new attempt `recovery-20260923-03`. Containment already stopped the
updater; restarting against the same log would break the single-init parser contract.
A new isolated official-base period is therefore required by the unchanged recovery
route; no log is trimmed and no current-only result is promoted into validation history.

v3 package: `/home/darko/passvero-signature-recovery-5b9e462-v3`.
Checksum-manifest SHA-256: `5244f4658e8e55a6aed57a91baae4bdf304a90151d50f779e5f537ee3f05d5cf`.
New archive: `/var/lib/passvero-signature-trust/records/recovery/recovery-20260923-03/`.
Staging execution PENDING_OPERATOR_COMMAND; readiness NOT_READY; reboot NOT_PROVEN.

## Subsequent PHASE_CHANGED and fresh read-only observation

The supplied v3 block stopped at verify-stop with PHASE_CHANGED and mutation_performed
false. It must not be replayed as a recovery instruction. Fresh unprivileged read-only
inspection found v3 already installed with expected recover.py SHA-256
`4a16d96c560e8b3a958cd12254d3b7236688d6e78121d470b184a24513cdc2d7`.
Freshclam PID 15352 and clamd PID 15401 were active/running; the producer timer was
active/waiting and the latest oneshot had Result=success, ExecMainStatus=0. Thus the
live state is newer than the attempt-02 stopped-state premise. No restart or further
recovery is appropriate from the supplied stale guard output. Root read-only journal
state and actual UID-1001 reader confirmation are pending; no inferred COMPLETE or
three-publication acceptance is recorded yet. These observations do not prove PDF smoke.

## Recovery A/B accepted — operator-confirmed current state

Attempt 01 and 02: ROLLED_BACK. Attempt 03: COMPLETE, active database is its
isolated directory. Daemon loaded-log and VERSION readiness both true, PID 15401.
The real UID-1001 reader accepted scheduled sequences 38169, 38170 and 38171;
a later independent read accepted 38181 with exit 0. Snapshot lifetimes are 60s;
no deadline/policy change. This proves initial publication, next two scheduled calls,
and further progress by the later read, not long-running unattended continuity.
[Sanitized evidence](evidence/signature-recovery/20260923-recovery-reader.json).
Dashboard build remains qwLCXFTd9EEGdvqaB9SZS. Producer recovery A/B = PASS.
Reboot and unattended acceptance remain NOT_PROVEN. PDF smoke/cleanup C = PENDING.

The prior browser session had ended; the user signed in manually, and the real UI
confirmed Passvero Acceptance with the existing synthetic draft. No credentials
were requested or recorded. No PDF has been uploaded yet.
The existing bounded UI acceptance receipt procedure requires an operator-owned
45-minute test window before uploading the exactly named fixture; ordinary UI
session authorization remains authoritative. Prepared run:
150b0aaa-f3f4-4ed5-894e-7d66083c3a2e, fixture A, 750 bytes,
SHA-256 98c913ee16f40bf9aeb51d3ec924d015a711cb8482b689fbb1987f6c6d9ff4b2.
The one-page synthetic PDF was locally rendered and visually checked; no business
or personal data. Window helper SHA-256:
63779b831e4f87fb5273cf34292e591699fcc53617aee825af0c3af116633489.
Its root-only cleanup record is under attempt-03/pdf-smoke; no DB/storage operation
or application restart occurs when opening the window. Opening is pending operator.

## Authenticated private PDF smoke — 2026-09-23 17:04–17:06 UTC

The real Chrome session in Passvero Acceptance uploaded one 750-byte synthetic PDF
to the existing unpublished UI acceptance draft. Initial UI state denied download.
One explicit scan changed the UI to “Provjere prošle”; authorized browser download
returned exactly the source bytes, SHA-256
`98c913ee16f40bf9aeb51d3ec924d015a711cb8482b689fbb1987f6c6d9ff4b2`.
Document ID: `fb953a8d-5f0b-4677-8330-fd3004533013`.
The private flag remained set; nothing was published. The exact attachment was
removed through the UI and the draft now has no documents. This detachment alone
is not storage cleanup.

The existing sealed-receipt cleanup was packaged for this single document and run
ID `150b0aaa-f3f4-4ed5-894e-7d66083c3a2e`. It uses the real session resolver, checks
CLEAN/policy 2/digest and terminal audit, archives through the existing persistence
method, removes the exact storage key and confirms the audit count remains intact.
No context is constructed from actor IDs. The wrapper uses the runtime's allowlisted
environment, excludes inherited IPC variables, drops to UID 1001, and refuses a
second cleanup attempt. Final cleanup and server-side audit verification remain
PENDING_OPERATOR_COMMAND. Temporary operator bundles and credentials are excluded
from the source manifest. No scanner test campaign or application redeploy occurred.

### Cleanup handoff limitation

Computer Use refused access to Terminal. No credential was copied, printed or
transferred by the agent, and no cleanup command ran. The reviewed cleanup package
is checksum-verified at `/home/darko/passvero-recovery-pdf-cleanup`. The operator
must run the existing private session handoff locally, followed immediately by the
checksum-verified sudo wrapper. Credentials must never be pasted into the report
or chat. The copied browser request is parsed as data and never executed; only
the existing staging Cookie header is passed through encrypted SSH stdin to the
existing exclusive 0600 handoff with 60-second expiry. No new token or context
is created. Cleanup remains PENDING_OPERATOR_COMMAND.

## Final operator cleanup accepted

The operator ran the reviewed package with checksum manifest
`87580c23a0f6b1bc6b39f399edccc3fa275898596f36168f3d33061d365f2958`.
The bounded v2 local handoff completed over encrypted SSH; no cookie was printed
or included in this repository. The original hidden-input helper stalled; v2 used
bounded noncanonical input terminated by Ctrl+D. This changed only the temporary
local handoff, not application or cleanup authorization.

Operator result: cleanup PASS, exact document
`fb953a8d-5f0b-4677-8330-fd3004533013` REMOVED, child exit 0, no stderr, audit
RETAINED, session_persisted false. The wrapper's success additionally requires
CLEAN/policy 2/checksum before cleanup and ARCHIVED plus unchanged audit count after
cleanup. `EXACT_TEST_OBJECT_CLEANUP=PASS; ACCEPTANCE_WINDOW_CLOSED; AUDIT_RETAINED`
confirmed closure of the exact optional window. No test publication, business-data
change, second scan, service restart, application deployment, commit or push.

[Final sanitized PDF evidence](evidence/signature-recovery/20260923-pdf-smoke.json).
The root-only operational record remains at
`/var/lib/passvero-signature-trust/records/recovery/recovery-20260923-03/pdf-smoke/exact-cleanup/`.
Secrets, temporary packages and synthetic PDF bytes are excluded from the source manifest.
Final report/roadmap/evidence edits are documentation only; the accepted v3 execution
source and producer bundle hashes above are unchanged. Existing tests/build are reused.

## Final source inventory

The adjacent `.sha256` manifest lists 13 files (implementation, tests, contract,
roadmap, report and two sanitized evidence files). The manifest itself is an
additional file: 14 changed/new files total. Final whitespace and exact manifest
coverage are checked locally. Index remains empty; the diff is ready for review.
