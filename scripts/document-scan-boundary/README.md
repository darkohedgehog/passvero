# Staging execution boundary (uncommitted artifacts)

Base: 975dc045a8238d8632f578449c1fbd88086fa2d1. This directory and its generated
bundles are a reviewed local diff, NOT content of that commit. No app deployment,
PM2 changes, production integration, scanner changes or document mutations occur
in installation, smoke or session-check.

## Calling boundary

The new root-owned socket is 0660 root:passvero-staging. The root broker also
checks SO_PEERCRED against the resolved passvero-staging UID. A PVQ1 length frame
contains at most 10 MiB of bytes, never a filename, argv or command. One worker,
backlog 1, a shared 10-second receive/validation deadline and a 64 KiB aggregate
child output budget bound work. The broker exclusively owns input lifetime.
Disconnect/cancel kills/reaps the parser before unlinking. On containment failure
it exits without unlinking; systemd kills its entire cgroup before removing runtime
files. Client transport failure is FAILED, never proof of a successful validation.

The accepted launcher and AppArmor profile are unchanged. The same fixed unit
name and cgroup helper preserve adapter 512 MiB / parser 256 MiB, swap 0 and pids
limits. The new unit runs ONLY the small fixed broker as root; subprocess launches
drop to passvero-qpdf with no supplementary groups. Neither the application nor
parser gains sudo/systemctl/cgroup configuration access. Root broker compromise
is a privileged risk; its protocol performs no shell/JSON deserialization of
commands, and all executable/unit files are root-owned and unwritable by callers.

Explicit unit delta from the former transient acceptance envelope: the fixed
broker is root instead of running the whole acceptance harness as passvero-qpdf;
it uses the accepted launcher to drop parser identity. Its supplementary group
list is empty. Existing network/home/system/kernel restrictions remain, with
additional inaccessible signature-trust/health directories, bounded capabilities,
and OOMPolicy=stop. There is no AppArmor permission expansion. The service has no
automatic restart. Smoke starts only the new socket and broker; no enable-at-boot action.

## Authentication

Log in through the existing staging browser flow and select the organization in
that flow. `private-session-channel.py` privately prompts for that existing
browser Cookie header (never paste it into chat). It sends it over encrypted SSH
stdin to an exclusive 0600 temporary file. The operator's ordinary sudo terminal
then runs `read-session.py`, which consumes/removes the handoff within 60 seconds
and starts the bundle as passvero-staging. It reads only allowlisted environment
keys from the unique existing staging next-server process, after checking its UID.
No credentials are printed, placed in argv, saved in evidence or loaded from
production. A failed channel removes only its own temporary handoff; an unprivileged 60-second expiry process also removes the same inode if the SSH connection is interrupted.

The bundle validates BOTH existing staging DB endpoint configurations, calls the
existing Better Auth reader and existing context resolver, and requires PRODUCT_EDIT.
A read-only repository rejects session-selection repair/creation. PGOPTIONS sets
both lazy PostgreSQL pools to default_transaction_read_only=on: expired Better
Auth session deletion is blocked too. The process exits after one check and emits
only PASS/FAIL. A missing selection means use the existing organization-selection
flow; no manual context or privileged identity lookup is substituted.

Future `createStagingScanRunner` resolves the session on EVERY call. Its inert
factory exposes scan/recover/cleanup without an endpoint; these methods are not
executed in this slice. The original app composition is unchanged.

## Exact cleanup

A dedicated per-run 32-byte key must be operator-provisioned through a private
runner channel/file (never CLI/request/config shared with end users). Preserve it
privately until cleanup finishes. The trusted creation wrapper seals only actual
createPending receipts and awaits durable journal retention BEFORE storage put.
Use createAcceptanceReceiptWriter: it writes each document's receipt exclusively, fsyncs it,
and retain failures; a single overwritten latest receipt is not acceptable. No
EICAR bytes, filenames or scanner output belong in this journal. These credentials
protect against an untrusted application request, not a compromised runner UID.

Authenticated cleanup verifies HMAC, exact tenant/actor/document/storage identity,
size/checksum and the run marker. Within a transaction it revalidates PRODUCT_EDIT,
locks Document and rejects all attachments and any PENDING scan. It uses existing
ARCHIVED/archivedAt/archivedById fields; no migration/delete/audit removal. The row
lock coordinates with existing attachment SHARE locks. Only after the transaction
commits does it call Supabase's exact-key Storage DELETE API. Storage failures
leave an unavailable tombstone and PARTIAL; an authenticated repeat retries the
same exact object and preserves audit/reference integrity. Pending scans first
need the separately authorized existing recovery operation, never forced cleanup.
A process/host crash before a receipt is durably saved remains an explicit
operational reconciliation case; never broad-delete by run prefix or tenant.

## Installation and rollback

`install.py` verifies artifacts, accepted profile/helpers and absent destinations,
then installs two Python files under /usr/local/libexec, two systemd units and
five root-owned files under /opt/passvero-scan-boundary. All files are 0644;
Python/Node interpreters execute them explicitly. It records root-only evidence in
/var/lib/passvero-qpdf-staging-20260914/execution-boundary-975dc04. No service starts.
`rollback.py` stops only the new socket/broker, checks inactivity, verifies hashes,
and removes exactly installed artifacts. Accepted qpdf/scanner files are retained.

`smoke-once.py` records its single attempt, verifies reviewed installed and
accepted launcher/profile artifact hashes, starts only the new socket/broker, and
runs one small valid PDF and one forbidden-operation frame as passvero-staging.
It verifies stable broker identity, socket permissions, request-bound child
lifecycle receipts, empty parser/input and diagnostic cleanup. Any unexpected result stops and rolls back the new boundary, no retry.
It is NOT full malware/recovery, production, or unattended-operation acceptance.

## Smoke diagnostics correction (local only, 2026-09-16)

The historical failure remains **NOT_RECORDED**: its retained JSON contains only
`AssertionError`. Service startup/rollback and the earlier M1 OOM entry do not
identify the failed check. Executed smoke SHA-256:
`30edfe0ea33cd01b1c24c21e9c6377cc1ec73ba7ba6f0353e781d27284f4e2d6`;
executed client bundle SHA-256:
`ca814d84b02b3ae550f43216911057e4f86666d44e8a5e948b2c8c6bf38c3438`.
Those historical artifacts are retained separately; they are not overwritten.

The corrected Python harness enumerates every check, including report writing,
observation-file removal and rollback. Reports contain only CHECK_ID, phase,
expected/actual enumerations, allowlisted normalized client kind, bounded duration, captured process exit/signal (or
UNAVAILABLE), and PASS/FAIL/NOT_RUN. Client output must match an exact field
allowlist and fit 4096 bytes; serialized reports cannot exceed 16384 bytes.
Raw observations, exceptions, stderr, unknown JSON fields and document identities
are never copied into the report. Failure is written before rollback; rollback has
its own row and cannot overwrite the first failure. Report-write failure emits a
fixed stderr message, fails the run and makes no evidence-preservation claim.
`smoke.json` is the success report; `smoke-failure.json` is the failure report.

The client passively observes its existing connection via Node's documented
`net.client.socket` diagnostics channel (a built-in experimental channel; see
https://nodejs.org/api/diagnostics_channel.html). It adds no connection, command,
retry or deadline. This CLI is single-purpose: the observer is subscribed only
around the existing validation call and removed in finally. The port's normalized
result and bounded observed response distinguish connection failure, timeout,
rejected request, missing/malformed response, valid-but-unexpected response and
identity mismatch. Socket errors are not copied or assigned an invented errno.
The forbidden-frame check retains its exact serialized rejection criterion.
Existing 15s socket-start, 20s client-process, 13s client signal, port 10s/3s,
and forbidden-frame 2s deadlines are unchanged.

Local Python operation doubles and TypeScript socket/operation doubles test the
harness, **not real broker compatibility or staging isolation**. No application
import path is changed; only broker lifecycle receipts, operator diagnostics and tests change. A full Next
build and DB proof are therefore not repeated for this correction.

### Previous prerequisite disposition

- **qpdf boundary:** fixed broker/peer credentials/cgroups and smoke are locally
  implemented. Installation was reported PASS; live smoke failed and the new
  boundary was rolled back. New boundary/isolation acceptance is NOT_PROVEN.
- **Auth/resolver:** existing Better Auth session and trusted organization resolver
  are used, with read-only DB guards and PRODUCT_EDIT enforcement. No real-session
  execution evidence exists. No session is requested by this diagnostics task.
- **Acceptance cleanup:** authenticated exact-receipt archival and post-commit
  exact-key storage deletion are implemented with local tests and the previously
  completed guarded disposable PostgreSQL proof (67 passing tests). This is not
  evidence of live cleanup; no live document/storage mutation occurred here.

### Next live procedure — separate authorization required, not executed

1. Review/commit the local implementation and diagnostics as separately approved;
   bind a new deployment manifest to the reviewed smoke sources and rebuilt client.
   Preserve the original manifests, failure JSON and single-attempt marker.
2. Prepare a reviewed new execution-record generation for installation, smoke and
   rollback together. The old installer intentionally rejects its existing record;
   do not delete/reset it or rerun the old package. This record-path preparation
   must not change broker protocol, privileges, profile, resources or criteria.
3. With explicit authorization for reinstall and ONE smoke, verify absent rolled-
   back destinations and unchanged accepted qpdf/scanner artifacts, install the
   reviewed generation, and start only the new socket/broker through smoke-once.py.
4. Run one valid PDF and one forbidden frame. Verify stable broker identity and
   socket permissions, staging peer identity, request/child lifecycle linkage,
   reaping, empty input and empty parser checks. Retain the
   sanitized check rows and captured client exit/signal. No session/DB/storage step
   belongs to this smoke.
5. On failure, stop at the first failure, retain NOT_RUN rows and separate rollback
   status; do not retry. On PASS, retain smoke.json and report only bounded smoke
   acceptance. Full scan/recovery integration remains a separate gate.

### Observation permission correction (local, 2026-09-16)

`/proc/<pid>/exe` sampling is acceptance telemetry, not the mechanism enforcing
parser execution. The fixed launcher, process credentials, enforced profile and
cgroup boundary remain unchanged; a configured boundary is not runtime proof.
The broker still computes PDF results from the same qpdf exits/output and keeps
its termination, reaping and input-lifetime rules.

Observation now distinguishes PERMISSION_DENIED, PROCESS_EXITED, READ_ERROR and
NOT_OBSERVED without copying exception messages. Partial reads are discarded.
Once a complete sample is obtained it is retained rather than sampled again
against an exited process. The diagnostic is written before cleanup, so a fatal
containment failure cannot erase the observation reason. Diagnostic write failure
emits a fixed message and does not replace the original PDF result or exception;
fatal parser containment continues to exit 70 and never reports scan success.

The smoke client invocation removes previous telemetry and lifecycle files.
Unavailable parser telemetry does not fail the explicitly narrowed functional
smoke and never produces isolation PASS. No expected configuration values are
substituted for a runtime sample.

### Approved functional/lifecycle smoke scope (local, 2026-09-16)

The operator explicitly accepted `NEW_HANDOFF_RUNTIME_ISOLATION=NOT_PROVEN`.
This smoke does not require direct executable, UID/GID, AppArmor profile, cgroup
or limit observation of the new short-lived parser. These remain separate evidence:

1. `ARTIFACTS_MATCH`: hash/ownership/mode checks of installed reviewed artifacts and
   accepted launcher/helpers/profile. This is static equality, not execution proof.
2. Historical parser isolation acceptance: retained for its original runs only.
3. New functional smoke: stable broker executable, exact command, root UID/GID,
   NoNewPrivs and PID/start ticks before/after; socket root:staging 0660; one client
   started with staging UID/GID and no supplementary groups; fixed PVQ1 bytes and
   forbidden frame; expected PDF result; child reaping and cleanup.
4. Independent runtime isolation of the new handoff: **NOT_PROVEN**, even when
   every functional check passes. No overall staging/production readiness claim.

The broker retains only its last two root-only lifecycle receipts (no payload,
filename, checksum, stderr or raw parser output). Kernel SO_PEERCRED supplies the
client PID/UID/GID. Client and broker start ticks bind receipts to the operator's
fresh client and unchanged broker, rejecting stale/PID-reused records. The parent
records actual Popen child PIDs, fixed operation labels, wait exit codes, reaping
and parser-cgroup emptiness; successful private-input cleanup is recorded only
after unlink/rmdir. The forbidden request must have no child. These are parent
lifecycle records, **not independent post-exec executable/identity/isolation proof**.
A failed/missing receipt cannot pass lifecycle acceptance. Fatal reap/containment
or input cleanup still exits 70; a successful PDF response cannot bypass those
controls. Optional observation/receipt write failures do not alter PDF verdicts.
The operator removes both receipt and optional telemetry files at completion.

No ptrace collector, CAP_SYS_PTRACE, capability expansion, AppArmor edit, parser
credential/launcher/resource change, protocol change or scan retry is introduced.
Local process doubles prove result separation, bounded receipt correlation,
stale rejection, first-failure preservation and lifecycle/cleanup rejection;
they do not prove Linux privilege compatibility. All new live evidence remains
unexecuted. The historical smoke cause remains **NOT_RECORDED**.

Current local disposition:
- LOCAL_BROKER_FUNCTIONAL_SMOKE_PREPARATION=COMPLETE
- BROKER_FUNCTIONAL_LIVE_SMOKE=NOT_RUN
- NEW_HANDOFF_RUNTIME_ISOLATION=NOT_PROVEN
- AUTH_REAL_SESSION_CHECK=NOT_PROVEN
- LIVE_ACCEPTANCE_CLEANUP=NOT_PROVEN

The next separately approved live step needs a new record generation and package
manifest; never rerun/reset the previously failed installation/smoke record.
