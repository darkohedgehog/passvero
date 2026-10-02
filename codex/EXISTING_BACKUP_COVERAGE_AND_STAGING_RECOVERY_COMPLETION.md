# Existing backup coverage and staging recovery completion

## Final result — approved one-off staging recovery COMPLETE

Recorded2026-10-02 Europe/Zagreb from returned operator output. No operator command
remains pending for this approved series. Capture is an as-of snapshot2026-10-01T21:23:54Z,
not a promise about future writes. Exact operator execution UTC was not in the final
output; the final application unit ran2.424s/success/status0, invocation
ac45bf2cfa6c4026acd3daee314dbad1. Complete evidence chain is retained in
codex/evidence/backup-recovery/approved-recovery-completion.json and
codex/evidence/backup-recovery/operator-application-recovery-pass.json.

| Component | Final evidence |
| --- | --- |
| Existing topology | Production PG16/passvero:5432 and separate passvero_test retained; acceptance PG16/passvero_acceptance:5433. passvero_migrator is an owner/deployment role, not a separate database. Runtime/auth/backup/test roles remain separated. |
| Existing production protection | Existing B2/restic PostgreSQL job, daily02:00UTC schedule/hourly freshness/Telegram, protected credentials and prior accepted production restore retained unchanged. Last inspected successful production set20261001T020750Z; this is accepted inspection evidence, not a fresh Oct2 production-job execution claim. |
| Actual addition | One consistent acceptance DB+all actually stored private staging document/image bytes+minimal non-secret config recovery set in separate restic prefix passvero-staging-recovery-v1/ in the existing B2 bucket. No production repository validator/job changes. |
| Set and offsite | Set20261001T212354Z;payload964172B. Real B2 snapshot2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2 downloaded and all file hashes verified. Repository9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35;recovery manifest2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132. |
| Consistency | Capture pause3.034s;51 tables locked;outsideDBclients0;stagingWriters0;Storage inventory+bytes unchanged. Accepted independent timeout resume proof reused. Application resumed before B2 transfer/restore. |
| File scope | Whole passvero-staging-documents/passvero-staging-images:5 stored objects/6145B, including every actually retained historical/archive/original/derived object present at capture. Nine DB references=5 stored+4 accepted cleanup tombstones. Deleted tombstone bytes2959B do not exist and were not restored; filename metadata alone is not a retained original. No automatic deletion. |
| Database recovery | Actual downloaded dump restored to private PG16/passvero_staging_recovery under /var/lib/passvero-staging-recovery/restore/20261001T212354Z/pgdata. All51 counters/31 migrations/owners/effective ACLs/sequences/refs MATCH; exactly6 reviewed constraint representations and6 owner-default ACL equivalences. No TCP; existing DB/test/staging never overwritten. Final DB verification reused during app read; no rerestore. |
| Application read | Actual catalog export, bounded PDF metadata/bytes reader and private image download/recheck services PASS using private restored DB/read-only ports and actual B2-downloaded filesystem bytes. Representative PDF629B/image1168B/checksums MATCH;catalog unchanged. All826 executable deployment artifact hashes matched;11 module input provenance verified against accepted build base. Raw historical src checkout is not executable identity. |
| Configuration | Included allowlisted runtime/PG settings+HBA/scanner requirements/source-build-package-lock identity in four configuration JSON files, linked by recovery-set.json hashes. Raw env/password/key/B2/SMTP/Telegram secrets excluded from config and never printed/committed/rotated. Protected DB dump retains required identity/business records. Full executable binaries and raw whole-system configs are not copied in this set. |
| Final closure | PASS;stagingONLINE_UNPAUSED;restore clusterSTOPPED;private parents0700 restored;reminder timerDISABLED_INACTIVE;campaignsEnabled0;all history/artifacts retained;SMTP/Telegram0 throughout this recovery series. |
| Reminder evidence retained | Four independently confirmed receipts, zero replay additional dispatches, two stale cancellations. No reminder/email acceptance repeated. |

Remaining dependencies are explicit limits of the completed proof: Supabase provider
reupload NOT_PERFORMED; full web service/authenticated session/fresh scanner trust
NOT_TESTED. Private-file application reading is not a full live provider recovery.
Independent protected secret/global role bootstrap inputs and available reviewed
source/build or retained deployment artifact are needed for full application bootstrap;
build identity in the config set is not a binary backup. Existing escrow procedure is
retained; its availability is not re-proven by this read harness. Fresh scanner/ClamAV/
qpdf evidence must be established before live document delivery, without bypassing
security gates. No such activation or new integration was part of this approved series.

Automatic staging backup/RPO/freshness/Telegram schedule NOT_INTRODUCED. Existing
production scheduling/reporting remains unchanged, and the proved staging snapshot
covers the capture instant only. A future recurring staging policy is a separate concrete
decision; no implementation work or operator command is opened automatically.
Local source unchanged main/originmainf778721ed77d87ad8e7de1dd38e0e5a51b688b60;
source operational helpers/tests/docs remain uncommitted, indexEMPTY. Accepted tests
are reused; only final evidence/JSON/manifest/whitespace/secret checks are needed now.
No production, secret, scanner/producer config, email/Telegram, deletion, retention,
forget/prune, commit or push action. All earlier checkpoints below are historical;
PENDING labels and commands in them are retained evidence, not current instructions.

## Historical checkpoint — artifact-bound application read subsequently passed; do not rerun

Returned READ_ONLY_APPLICATION_MODULE_INVENTORY_V2 completed: raw Git checkout
3eec70abc80887eb4c098236c9b54ebc28d9fc58, six missing modules, two different document
modules, three identical modules. All five present sources match that checkout exactly;
LF/BOM conversion does not explain differences. Installed build/helper/closure evidence
is private0600/hash-matched, original application attempt absent. It does NOT prove
that running staging build is3eec70a: reviewed deploy intentionally replaces only.next
and messages, leaving rawsrc and Git checkout untouched. Earlier statement that staging
runs the old Git revision is superseded by this distinction. No app upgrade justified.

Actual root cause: verifier incorrectly used historical rawsrc as execution identity.
Reviewed installer scripts/subscription-reminders/install.py establishes accepted
reminders deployment build8QNIYVVZWEsQaCL9uLZ5Q/manifest1d7f456d13ce8cf1bb7173bc3c731be4fd7e61d6a5fbb70fb8aca99eba04f1cf.
Local evidence verifies all11 unchanged recovery bundle inputs against accepted original
build base1fc84aa8ccc3118f8158029e8edf99275c8f7f6e and all826 local build artefact bytes
against the accepted deployment package. No new application bundle or production code.

Corrected helper validates that same pinned existing deployment manifest, captured
package/lock/build identity, canonical manifest's reminder provenance, all826 live
.next/messages file hashes and existing runtime dependency hashes. Hash mismatches
still STOP; no general bypass/normalization. Readonly artifact hashing does not redeploy
or repeat email/Telegram acceptance. Raw checkout is explicitly not execution identity.
Reuse installed hash-pinned bundle/build. New private provenance file549271de0275b711bab687ce0a954887054debdfde4ccd55c0fcc20b2991f58d,
helper e168795c416c97deb477d22999bf01438bf2e502b76bc3acfb8073e350204abf,
unit application-artifact, and separate application-recovery-artifact attempt/config/
summary/closure names preserve original helper/closure/claims. Same already restored
PG16/socket-only/read-only cluster; no new database, rerestore, staging pause or transfer.
Same300s/25s/control-group/UMask0077/ExecStopPost/ACL cleanup boundaries. On STOP retain
reason and evidence; no automatic retry. Ten affected full operator-flow tests and four
complete installer fixtures PASS, including stale/missing raw checkout with matching
executable artefacts, changed executable/runtime/provenance/canonical manifest, existing
claim/unit and retained prior bytes. Exact2 payloads/Python/shell packaging PASS; unchanged
10 actual application-reader tests reused. Operator application proof remains pending.

Captured set20261001T212354Z/snapshot2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2:
B2 download/all-file hashes and final51-table/31-migration/ACL/count/sequence/ref DB
proof retained. Latest closure: clusterSTOPPED,parents0700,stageONLINE_UNPAUSED,
reminder timerOFF/campaigns0. Four confirmed receipts/replay0/two stale cancellations
retained. Production backup/freshness/Telegram/scanner/producer/credentials unchanged;
one-off recovery only, automatic staging backup schedule not introduced. Private app
service proof only; Supabase reupload NOT_PERFORMED and full web/auth/fresh scanner
recovery NOT_TESTED remain explicit dependencies. No deletion, commit or push.
PENDING_OPERATOR_COMMAND_APPLICATION_ARTIFACT_RECOVERY.

## Historical checkpoint — inventory V2 subsequently completed; do not rerun

Returned diagnostic STOP/FileNotFoundError/writes NONE/clusterStarted false. The
first diagnostic incorrectly required every installed evidence/source path to exist
and did not identify the missing path. No conclusion about which path is absent is
yet supported. Its failed source/command remains retained as historical evidence.
This does not invalidate the accepted B2/DB restore proof or repair the original
APPLICATION_MODULE_CHANGED preflight; application proof remains NOT_YET_RUN.

Correct only the read-only diagnostic: embed the exact11 reviewed expected module
identities, independently inventory installed build/helper/closure and all11 sources.
Missing, unreadable, unsafe-private, nonregular, symlink and oversize paths are labeled
with their precise reviewed path; no source text/secret is printed. Missing installed
metadata no longer prevents source inventory; missing sources no longer hide remaining
rows. Existing Git HEAD/source hashes are optional readonly metadata. Hash mismatch
is reported, never accepted/bypassed. Closure metadata inventory is not current runtime
health proof. No source deployment, SQL/cluster start, ACL/file writes, pause, B2/Storage,
SMTP/Telegram calls, acceptance retry or automatic cleanup. Seven focused tests PASS,
including full main flow with missing build/helper/closure/source files and absent Git;
Python/shell syntax and exact-source block checks PASS. Prior acceptance reused.
PENDING_OPERATOR_COMMAND_READ_ONLY_APPLICATION_MODULE_INVENTORY_V2.

## Historical checkpoint — module diagnostic subsequently hit missing file; do not rerun

Operator unitfaf168178f56437bba9e8a473eb920bc returned APPLICATION_RECOVERY_PREFLIGHT /
APPLICATION_MODULE_CHANGED in0.583s. At least one of the11 live application source
hashes differs from the reviewed bundle; first mismatched path was not printed by
the original fail-fast guard. Package/lock/build identity and downloaded-set checks
preceded this guard successfully. Source control flow stops before application attempt
claim, ancestor ACL grant, cluster start or application read. Do not infer why code
bytes differ, bypass source checks, redeploy staging or re-run the acceptance unit.
Closure PASS: cluster STOPPED, parent0700, staging ONLINE_UNPAUSED, reminder timer
DISABLED_INACTIVE/campaigns0, SMTP/Telegram0. Actual B2 download/file checksum and
final DB recovery PASS remain accepted. Application proof remains NOT_YET_RUN.
Raw evidence: codex/evidence/backup-recovery/operator-application-preflight-module-changed.json.

Minimal next read-only diagnostic: verify installed helper/build pins and saved closure,
confirm application attempt absent; print all11 expected/current hashes, optional VPS
Git HEAD/source hashes and LF/no-BOM comparisons for mismatches. No source contents,
credentials, SQL, cluster start, permissions/file writes, B2/Storage calls, staging
pause or acceptance retry. Four synthetic hash/CRLF/code-change/symlink fixtures and
Python/shell syntax PASS. Local11 module hashes equal current HEAD; VPS identity
must be established from operator output before choosing a source correction.
All accepted capture/B2/DB/reminder/timeout/Telegram checks reused unchanged; no
production/backup schedule/freshness/credential change, email, deletion, commit or push.
PENDING_OPERATOR_COMMAND_READ_ONLY_APPLICATION_MODULE_IDENTITIES.

## Historical checkpoint — application preflight subsequently stopped; DB proof retained

Returned operator evidence recorded 2026-10-02; set20261001T212354Z, actual B2 snapshot
2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2.
Final database unit invocation3ddfbb1dcdcb40e58f23b009e72102d6 completed success/status0
in2.571s. All51 tables/counters,31 migrations, sequences, database ACL and catalogue
owners/ACLs MATCH. Exactly six reviewed constraint representations and six owner
ACL/default equivalences accepted by their bounded comparator. Nine asset references,
five restored stored objects and four accepted cleanup tombstones verified.
No rerestore/schema/business writes. Closure PASS: cluster STOPPED, private parents0700,
staging ONLINE_UNPAUSED, reminder timer DISABLED_INACTIVE, campaignsEnabled0.
Raw sanitized output: codex/evidence/backup-recovery/operator-final-database-verification-pass.json.

Only remaining operator step: isolated application services read from this already
verified private database and actual B2-downloaded filesystem bytes. Reviewed helper
c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee starts the same
socket-only PG16 cluster with default_transaction_read_only=on; it does not restore
again or pause staging. Hash-pinned bundle uses11 deployed application modules
(checked against unchanged captured package/lock/build identity) and existing zod.
Actual catalog export and private image download/recheck services, plus bounded PDF
bytes/metadata reader, run with readonly SQL/private filesystem ports. No credentials
or live application environment passed. All mutation/public transport ports denied.
Exclusive attempt/summary/closure retain history. Unit UMask0077,RuntimeMaxSec300,
TimeoutStopSec25,control-group kill and independent ExecStopPost preserve the accepted
private ancestor ACL/0700 closure. No automatic retry on STOP.

Local evidence:10 application reader tests and6 synthetic complete operator tests
PASS; focused strict TypeScript/Python/Node/shell checks and exact three-payload/hash
packaging PASS. Prior capture, real B2 download/checksum, final database, timeout,
reminder delivery/replay/stale cancellation and Telegram acceptance reused unchanged.
This proves private application service reading only: Supabase restore NOT_PERFORMED;
full web service, authenticated session and fresh scanner trust NOT_TESTED. Independent
secret/role credential escrow and provider/scanner activation remain recovery dependencies.
Four confirmed reminder receipts, replay0 additional sends and two stale cancellations
retained. Production backup/freshness/Telegram/scanner/producer/credentials unchanged;
no email, new staging schedule, deletion, commit or push. This is a one-off recovery set.
PENDING_OPERATOR_COMMAND_APPLICATION_RECOVERY_READ.

## Historical checkpoint — final DB verification subsequently passed; do not rerun

Review update2026-10-02 Europe/Zagreb. Returned six full definition pairs match all
12 previously returned SHA signatures. Differences are solely associative grouping
of existing AND operands and uniform varchar-array→text[] casting versus individual
varchar-element→text casts; predicates, limits, literals, column references, regexes
and OR groups are identical. No schema change warranted. New comparator accepts
only these exact six (table,constraint,sourceSHA,restoredSHA) pairs; no generic text/
parenthesis/cast normalizer. Other constraint fields and all other catalogue sections
remain strict. For exactly six owner-only relation ACL→NULL pairs, require identical
owner/kind/RLS/name, ownerpassvero_migrator/tablekindr, exact old ACL; then SELECT
aclexplode of saved ACL versus coalesce(actualACL,acldefault('r',actualOwner)). Compare
grantor/grantee/privilege/grant-option lists; no GRANT/REVOKE or permission repairs.
Unexpected differences remain STOP. This corrects the verifier's overly strict text
comparison, not restored schema/data. The reviewed full definitions are retained.

Next is already approved final verification of the existing B2-restored database:
51 table counters,31 migration metadata/checksums, sequences, owners/ACL,9 exact
asset references/5 stored objects/4 accepted cleanup tombstones. Same private PG16
cluster, no re-restore/new target, TCP disabled, SQL default read-only, business/schema
writes NONE. Distinct database-final unit/claim/closure; UMask0077,300s/25s/control-group/
ExecStopPost protections, named postgres execute-only ancestor ACL and0700 cleanup
retained. Actual PG acceptance and isolated application product/PDF/image reads
remain pending operator output. No repeated B2/capture/reminder/Telegram acceptance.

11 affected comparator tests PASS: exact pairs/effective ACL pass, changed limits,
owners,grants,RLS,role/function/constraint identity/count fail; inputs unchanged.
Full installer exact source/hash/UMask/closure/Python/shell syntax PASS. Prior tests
and accepted runtime/capture/B2/private byte checks reused. No Codex privileged action,
production/schedule/freshness/scanner/producer/credential change, email, business or
snapshot deletion, commit or push. No automatic staging schedule introduced.
PENDING_OPERATOR_COMMAND_FINAL_DATABASE_VERIFICATION. Application read is next.


## Current checkpoint — catalog diagnosis PASS; six constraint definitions pending review

Returned READ_ONLY_RESTORED_CATALOG_COMPLETE is successful diagnostic, not DB acceptance:
12 differences only: six constraint-definition hashes and six relation ACLs. All
columns,defaultACLs,enums,functions,indexes,migrations,roles,schemas,pending counters,
non-public schemas and large objects match strictly. Six ACL pairs are owner-only
{passvero_migrator=arwdDxt/passvero_migrator} versus null/default. PostgreSQL16
privilege docs describe null as default privileges; semantic validation must still
check each relation owner/kind and actual expanded ACL, not ignore ACLs globally.
No permission/schema correction justified by these ACL representations alone.

Diagnostic closure PASS: private cluster stopped, parent0700, stage online,timerOFF,
campaigns0,SMTP/Telegram0. No restore repeated or business/schema writes. Constraint
hashes alone do not prove logical equivalence or actual difference. Next minimal
operator block reads the already saved source and restored catalogues, verifies B2
manifest/source-catalog SHA and saved constraint-difference hashes, and prints only
six metadata definition pairs. No cluster start, SQL, chmod, provider call, file write,
new database or rerestore. Await concrete definitions before comparator correction.
Python/shell syntax PASS; existing8 diagnostic and28 restore tests reused unchanged.
Capture/B2/reminder/timeout/production/freshness/Telegram proof remains retained;
full DB/application recovery still pending. No commit/push or automatic schedule.
PENDING_OPERATOR_COMMAND_SAVED_CONSTRAINT_DEFINITIONS.


## Current checkpoint — dump restored; strict catalog mismatch STOP; closure PASS

Returned helper5fb296f9... proves closure permission repair PASS/contents unchanged.
Unit invocation66133792f28045ce89f45b6ed23fdae9 stopped VERIFY_RESTORED_DATABASE /
RESTORED_CATALOG_MISMATCH after3.233s. Source control flow reaches this check only
after successful single-transaction pg_restore and database-ACL application. This
is restored data, not an accepted DB recovery proof. Returned closure PASS: isolated
cluster STOPPED, ancestors0700, staging online, reminder timer OFF/campaigns0,
SMTP/Telegram0. No restore rerun or new destination is proposed.

Next bounded diagnosis imports the installed hash-pinned helper, rechecks downloaded
B2 manifest/bytes and original private failed unit/closure, matches PG16 existing
pgdata/socket ownership and saved parent ACL inode identities, then temporarily
starts only this same cluster without TCP and default_transaction_read_only=on.
It SELECTs the captured catalogue, saves the full current catalogue privately and
prints differing sections/field paths; owner/ACL metadata is shown, SQL definitions
and defaults only hashed. Text/row-order-only equality is a diagnostic hint, not a
waived ACL check. No table/role/ACL/schema mutation or pg_restore; private runtime,
logs, attempt/evidence and temporary ancestor ACL are written as operational proof.
Separate catalog-diagnostic unit/claim/closure;UMask0077,300s/25s,KillMode control-group
and ExecStopPost enforce private-cluster stop and ancestor0700 restoration. Never
reset previous attempts; on error retain evidence and STOP/manual review. PG/application
acceptance remains NOT_PROVEN until remaining comparisons and reads pass.

8 new affected synthetic diagnostic tests plus complete installer source/hash/guard
and Python/shell syntax PASS; old28 restore tests and accepted capture/B2/reminder/
timeout proofs reused. PENDING_OPERATOR_COMMAND_CATALOG_DIAGNOSTIC; no privileged
operation executed by Codex. Existing B2/production/freshness/Telegram/scanner/producer/
keys unchanged; no automatic staging schedule, email, snapshot/business deletion,
commit or push. Private filesystem proof is not Supabase/full application recovery.


## Current checkpoint — PRIVATE_PATH cause confirmed; private-closure repair ready

Returned READ_ONLY_RESTORE_PRIVATE_PATH checked33 paths: the only failures are
originalClosure and stdlibClosure, regular root-owned0644. No restore attempt,
pgdata, socket directory or ACL baseline exists; writes/providers0. Actual defect
confirmed: prior ExecStopPost lacked a process umask and unit UMask. This was not
a DB, Storage, offsite or ACL-xattr failure; none of those new restore operations ran.

Minimum repair: explicitly os.umask077 in close(), unit UMask0077, and a guarded
one-time0644→0600 repair of exactly the two non-secret retained closure JSONs.
Both full JSON values must match accepted closure exactly, ownerroot/regular/single
link/mode0644/size<8192 via O_NOFOLLOW-held descriptors. Previous stdlib unit result,
invocation d3b214d0c90944acb5be57f7656da545 and helper hash must match; no attempt/
pgdata/socket/ACL baseline may exist. Record both before hashes privately before
fchmod; verify bytes/inode/device/owner unchanged. No validator weakening, generic
chmod, secret reading, package install, old helper or unit reset. Original closure
bytes are preserved. Any unexpected condition STOP/manual review; never auto retry.

Reviewed new helper5fb296f96c37fb3ebfb681f534e6df01cf392c9fb8b993c322f696d20794fd0f;
new unit passvero-stage-restore-20261001T212354Z-private.service;300s/25s/control-group
limits and separate ExecStopPost retained. New restore-closure-private.json, old
closures retained. Named postgres execute-only ACL and inode-bound cleanup unchanged.
28 affected synthetic tests PASS, including start-close-with-umask022→0600 regression,
content/mode/unit/claim rejection and bytes-preserved two-file repair. Complete
installer exact-source/hash, UMask property, shell/Python syntax PASS. Live repair/
PG/application reads NOT_YET_RUN; PENDING_OPERATOR_COMMAND_PRIVATE_DATABASE_RESTORE.

Reuse accepted actual B2 snapshot2c317b57.../5objects/all964172 bytes, capture3.034s,
independent timeout proof and reminders4 receipts/replay0/cancelled2. Staging remains
online per latest accepted closure; timer/campaigns OFF. No new capture, B2 upload,
email, Telegram, production job/freshness/schedule/credential/scanner/producer change,
automatic staging schedule, deletion, commit or push. Private filesystem proof still
does not imply Supabase or full service recovery. Application read follows DB proof.


## Current checkpoint — PRIVATE_PATH preflight STOP; closure PASS; read-only diagnosis pending

Returned stdlib helper9e092b11... unit invocation d3b214d0c90944acb5be57f7656da545
stopped RESTORE_PREFLIGHT/PRIVATE_PATH after353ms. Closure PASS: cluster stopped,
parents0700, stage online, timer OFF/campaigns0, SMTP/Telegram0. Accepted B2 retrieval
and capture remain unchanged; no automatic restore retry. Source review identifies
an unconfirmed hypothesis: separate ExecStopPost process does not set os.umask077,
and the unit does not specify UMask0077, so prior closure JSON may be0644 and rejected
by cap.read/private. Do not change rights or loosen validators on that hypothesis.
A bounded read-only lstat inventory is the next operator command; no contents of
secrets, no SQL/Storage/B2/network provider calls, no pause or restore. It identifies
exact private-path failures and existence of attempt/pgdata/ACL baseline. Await
actual output before a repair/continuation. Prior22 synthetic tests reused; diagnostic
Python/shell syntax PASS. No source/helper edits, commit, push or deletion this turn.


## Current checkpoint — PG preflight STOP; closure PASS; reviewed ACL continuation

Returned database restore STOP: RESTORE_PREFLIGHT / ACL_TOOL_UNAVAILABLE.
Original helper15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034 remains installed and retained.
Unit passvero-stage-restore-20261001T212354Z.service / invocation
e2d37c7e744149efb0afbe3ea63f76c8 exited1 after539ms. Returned closure PASS:
cluster STOPPED;parent0700;staging ONLINE_UNPAUSED;timer disabled/inactive;campaigns0;
SMTP/Telegram0. Source ordering places missing-tool STOP before attempt/ACL/pgdata
writes. The continuation checks original source hash, unit result/invocation, retained
closure and absence of attempt/pgdata/old ACL backup before proceeding; no reset.

The only source repair replaces getfacl/setfacl with Python os.getxattr/setxattr/
removexattr for Linux system.posix_acl_access, according to kernel UAPI v2 tags and
little-endian encoding. No package installation, new dependency, chmod broadening,
production configuration or credential permission change. Existing extended parent
ACL remains STOP. Named postgres entry grants execute only, group/other0; original
three parents' inode/device/uid/gid/mode are saved privately. ExecStopPost verifies
identity and expected ACL before removal/restoring0700; it attempts all three even
if one fails and reports a closure error rather than claiming success. Existing
preflight closure retained, new restore-closure-stdlib.json written exclusively.
Reviewed continuation source9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7;
new transient unit suffix -acl-stdlib;300s runtime/25s stop/KillMode control-group
unchanged. Any actual attempt failure remains STOP, no automatic retry.

22 affected synthetic tests PASS; complete installer source/hash fixture and shell/
Python syntax PASS. Linux ACL operations are mocked locally; live Linux/PG restore
remains NOT_YET_RUN. Already accepted B2 snapshot2c317b57.../bytes964172/5objects,
capture3.034s/resume, independent timeout and reminder4 receipts/replay0/cancelled2
are reused. No B2 transfer, capture pause, email or Telegram acceptance repeated.
Existing production jobs/freshness/schedules/keys/scanner/producer unchanged. No
automatic staging schedule, commit, push or deletion. Isolated application read
remains pending after DB proof; private filesystem proof is not Supabase recovery.


## Current checkpoint — real B2 retrieval and byte restore PASS; PG restore pending

Operator output for set `20261001T212354Z` confirms snapshot
`2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2`,
repository `9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35`,
manifest `2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132`.
Exact separate prefix passvero-staging-recovery-v1/;964172 bytes;all set files
checksummed;5 stored objects6145 bytes;9 references and4 accepted absent tombstones.
This is actual B2 retrieval into private filesystem, not a Supabase restore.
Staging ONLINE_UNPAUSED, reminders disabled/inactive, campaigns0, SMTP/Telegram0.
No additional capture or B2 upload is needed or authorized as an automatic replay.
Capture3.034s closure, four confirmed reminder receipts/replay0/two cancelled and
unchanged accepted production backup/freshness/Telegram evidence remain retained.

Next approved phase is the exact downloaded dump into new private PG16 pgdata,
DB passvero_staging_recovery, socket-only55434. A root-owned hash-pinned operator
helper executes in its own bounded transient systemd unit; maximum300 seconds,
stop25 seconds, KillMode control-group plus ExecStopPost restore/closure. Only the
new isolated cluster is terminated on interruption/error/timeout. Existing target,
attempt or unit means STOP, never overwrite/retry. Parent ROOT/restore/set remain
root0700 except temporary named execute-only postgres ACL; original basic ACLs
are saved privately and restored by ExecStopPost. Existing extended ACL or missing
existing ACL tools means STOP before the attempt; no package installation or rights
changes to credentials, storage or production. Backups remain root0600. No trust
HBA, role passwords or TCP listener; root/postgres peer authentication on private
socket only. Roles' captured attributes, ownership and relevant schema/table/function/
enum/default/database ACLs are compared; passwords and uncaptured role memberships
remain independent protected recovery dependencies, not whole-cluster claims.

15 affected local synthetic tests, full installer source/hash fixture and shell/Python
syntax PASS. Old accepted guard/source/offsite proofs are reused, not repeated.
PG/application restore is NOT_YET_RUN until operator output. This database phase
stops the private cluster and retains it for the subsequent already-approved isolated
application read. It does not launch a web server, timer, business worker or scanner.
No automatic staging backup schedule, production change, commit, push or deletion.


## Current checkpoint — consistent capture PASS; B2 transfer pending

Returned operator evidence for `20261001T212354Z` proves capture PASS and staging
ONLINE_RESUMED after 3.034 seconds. Reviewed helper d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa was installed; original failed claim/set retained.
51 tables locked; outside clients0 and staging writers0; Storage metadata/bytes
unchanged. Set964172 bytes;5 stored objects;9 references;4 accepted absent tombstones.
Accepted independent timeout proof reused. Additional pause consumed; no new pause
or capture retry is authorized by this continuation. Reminder timer disabled/inactive,
campaigns0; accepted four receipts/replay0/two cancelled remain unchanged.

Next is the already approved exact-prefix B2 upload and real private filesystem
restore. New offsite helper has12 synthetic contract tests PASS; old42 source tests
are reused. The complete operator block is below. It verifies existing credentials
and prefix without printing secrets; never runs the production backup job or retention.
Exclusive attempt/restore paths prevent replay/overwrite; failures retain artifacts.
Database restore and isolated application reads remain NOT_YET_RUN, as does B2 until
operator output. Filesystem bytes alone prove neither Supabase nor full service recovery.
No automatic staging schedule introduced; production/freshness/Telegram unchanged.
No privileged command run by Codex, no commit or push.


Date: 2026-10-01 (Europe/Zagreb). Checkpoint: B2_REAL_RETRIEVAL_BYTE_RESTORE_PASS_PENDING_PRIVATE_DATABASE_RESTORE;
operational completion is not yet claimed.

## Returned pre-capture installer state — approved pause unused; corrected transport ready

[Returned read-only state](evidence/backup-recovery/operator-additional-installer-stop-state.json)
confirms original claim retained, no extra claim, no corrected helper installed,
staging online and reminder timer/service/campaigns OFF; writes/providers0. The
additional pause was not consumed. This closes the installer-only manual review;
no additional approval is needed to execute the still-approved capture once.

Current runbook contains a complete short-line delta installer, using the retained
failed helper0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865 as the verified source base. Patch and final source hashes
are checked before compile/install/exec. Resulting helper is byte-for-byte the already
approved d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa; no source or guard changes.
Seven affected full-installer fixtures plus Python/shell syntax PASS. Existing42 source
tests and accepted live guard/formatter/Storage evidence are reused, not repeated.
No helper deployment/capture/new pause/B2/restore run by Codex. Index empty; no commit
or push. PENDING_OPERATOR_COMMAND_APPROVED_CAPTURE_DELTA; await returned output.
All original resource/deadline/identity/claim/closure and no-retry limits remain.
Earlier sections below retain historical checkpoints, not current replay instructions.

## Additional installer STOP — assistant pasted payload defect; manual review

[Returned installer STOP](evidence/backup-recovery/operator-additional-installer-stop-error.json)
reports Error before any helper-installed success output, stagingPauseRequested=false,
remote writes/SMTP/Telegram0 and retained artifacts. The assistant response had
internal spaces in Base64 literals; strict decoding reproduces binascii.Error/class
Error. Reviewed source and intact runbook payload still match the explicitly approved
hash d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa. No source/runtime/guard change.

Decoding precedes exclusive helper install and exec/capture/extra claim; source
control flow explains why this failure occurs before a new pause. Do not promote
that deduction to a current VPS artifact/state check. A complete narrow read-only
operator block now checks original/extra claims, installed helper identity, current
staging and reminder gates. PENDING_OPERATOR_COMMAND_INSTALLER_STOP_READ_ONLY;
four local fixtures + shell/Python syntax PASS; source42-test acceptance is reused,
not repeated for a new PASS. The prior successful2.743s closure remains accepted.

No capture rerun, new pause, remote transfer/restore, scanner/producer/config/secret
change or deletion. The additional one-pause approval is retained; the damaged block
is historical and must not be replayed. If an extra claim exists, stop and preserve
it. Wait for the operator's actual state before any concrete corrected handoff.
Production/freshness/Telegram and accepted reminders4 receipts/replay0/cancelled2
remain unchanged. No commit or push.

## Current source baseline

Local main, local origin/main and live GitHub refs/heads/main were verified as
`f778721ed77d87ad8e7de1dd38e0e5a51b688b60`. Initial worktree and index were clean.
This task authorizes no commit or push. The reminders acceptance remains closed:
timer disabled/inactive, campaigns disabled, four confirmed receipts, zero replay
additional sends, two stale messages cancelled. No reminders or Telegram acceptance
is repeated here.

## Consolidated existing evidence

| Area | Existing accepted evidence | Current checkpoint / remaining proof |
| --- | --- | --- |
| PostgreSQL production | PG16 main on localhost 5432; database passvero. Migrator is a role owning objects, not a separate database. passvero_app runtime, passvero_auth provider runtime, passvero_migrator deployment, passvero_backup SELECT-only, passvero_test test identity. | V3 confirms both clusters, database names, ownership, role/connect matrix and migrations. Existing production job target and current offsite evidence are matched. |
| Test | Separate passvero_test database and role in main; historical integration tests. | V3 confirms separate test database/owner in main; existing backup role cannot CONNECT. It is excluded from the identified production job and this staging supplement; retained, never overwritten. |
| Staging/acceptance | Retained 2026-09-30/10-01 reminders evidence identifies PG16 acceptance, localhost 5433, /var/lib/postgresql/16/acceptance, passvero_acceptance; app /var/www/passvero-acceptance. Latest reminder migration is part of today's data. | V3 confirms 31 successful migrations and current counters. Identified production job does not capture acceptance DB/Storage. Existing acceptance is never a restore target. |
| Existing offsite destination/job | Encrypted Backblaze B2 restic; protected locator /etc/passvero/backup/restic-repository. /usr/local/sbin/passvero-postgres-backup and existing backup service/timer. Historical target passvero_backup → passvero → loopback 5432; snapshot host passvero-production, tag passvero-postgresql. | Pinned installed source and selectors reviewed: DB-only production target; snapshots lists unfiltered, production-only validators, production-filtered retention. Same restic repository cannot safely receive a separately scoped staging snapshot. |
| Schedule/freshness | Daily 02:00 UTC with up to 10-minute delay, Persistent. Hourly freshness using /var/lib/passvero-backup/state/last-valid-offsite.epoch; documented 93600-second threshold. 14 daily/8 weekly/6 monthly retention. | Current timer/service state, marker age and matching 20261001T020750Z offsite evidence retained. No schedule/retention mutation. Live B2 retrieval of today’s staging set remains pending. |
| Recovery operational history | 2026-08-24 completion records backup-validator correction, controlled backup, new valid offsite evidence, canonical marker advancement and freshness recovery PASS. | Today's job state/coverage. Earlier failed incident baseline is preserved as history, not current failure. |
| Accepted real B2 restore | 2026-08-18 set 20260818T020055Z, snapshot 0c65660c6e55641efa4a3fa40fd53afdbc2b24b51edf1d6f23f99cacece891bf; isolated PG16 schema/data/ownership/DB-local ACL/migrations/constraints/indexes/exact manifest counts PASS; 1695.365 seconds. Evidence /var/lib/passvero-backup/evidence/passvero-restore-drill-20260818T145708Z.evidence. | Reuse unchanged mechanics. Does not by itself prove the September/October staging recovery set or file restoration. |
| Telegram | User confirms existing integration and accepted reporting checks. Existing freshness/backup implementation is reused. | Installed script hashes/protected file metadata and successful service states retained. Existing accepted reporting remains; no bot values or test messages. No new staging Telegram/freshness claim. |
| PDF and images | DB contains Document and immutable ProductImageAsset storage identity/size/SHA256, with version links ProductDocument/ProductImage. Adapter namespaces passvero-staging-documents and passvero-staging-images; private Supabase reads. | Actual byte backup/restore, all retained historical/unlinked/legacy objects and any originals/derivatives, DB-manifest reconciliation. DB references are not byte backups. |
| Config/secrets | DR runbook documents separate deterministic bootstrap for global roles/ACL and PostgreSQL configs. Protected app, DB, B2/restic and Telegram recovery inputs were operator-confirmed in the 2026-08-18 governance record. | Minimal today's non-secret configuration include/exclude and protected independent secret recovery availability. No secret values, rotation, edits or commits. |

## Source findings completed independently

Reviewed current storage adapters, immutable asset models and image normalization flow.
New image upload normalizes the incoming bytes before storing one ProductImageAsset;
it does not retain a separate raw upload in that path. Original filename is metadata,
not evidence of retained original bytes. Preserve all actually stored historical/LEGACY
objects; inspect the real bucket inventory before stating that all originals/derivatives
are covered. No change to the upload architecture is proposed merely for backup proof.
PDF Document records include archived/history and potential pending/failed uploads:
the recovery manifest must distinguish expected retained objects from incomplete uploads
and unreferenced stored objects without automatically deleting either.

No backup implementation diff, database, repository, credential, job, integration or
schedule has been invented. No live backup, restore or restic command has run.
Prepared a bounded temporary read-only probe and the complete operator handoff.
Python syntax and mock secret-filter checks PASS. No application tests/build are needed
for this documentation/diagnostic checkpoint; existing application proofs remain retained.

## Returned inventory — 2026-10-01 17:24:53 Europe/Zagreb

Sanitized operator output is retained unchanged in
[evidence/backup-recovery/operator-inventory-20261001.json](evidence/backup-recovery/operator-inventory-20261001.json).
The first probe result READ_ONLY_COMPLETE describes completion of that probe, not
complete topology/coverage verification. Its pg_lsclusters JSON adapter expected
`status`, `owner` and `datadir`; those keys were absent, so the condition silently
skipped every SQL query. This is a diagnostic implementation defect, not evidence
that clusters are offline. Local reproduction confirms the skipped-query branch.
The follow-up directly queries the two known socket ports and verifies the cluster
identity through PostgreSQL; it does not repeat the successful timer/marker inventory.

Confirmed current existing system:
- Production job constants and protected pgpass agree: passvero_backup → passvero
  → 127.0.0.1:5432; snapshot host passvero-production. Installed source SHA256
  5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75.
- Backup timer enabled/active, daily 02:00 UTC + 10min randomized delay, Persistent.
  Last timer trigger 2026-10-01 04:07:34 CEST. Freshness enabled/active hourly,
  Persistent; last trigger 17:00 CEST. Both service Result values report success/exit0;
  their execution timestamps were blank, so no new journal/invocation claim is made.
- Latest retained offsite record: set 20261001T020750Z, snapshot
  42e0fc88a37bc80b8c94e6cbbc5efd673ea5cb6a9d8884d0ea841375373d19d4.
  Canonical marker advanced at 04:08:20 CEST; age 47793 seconds at collection,
  under the documented 93600-second threshold. This is current local validation
  evidence; no live B2 listing/retrieval has yet been executed in this task.
- Accepted 2026-08-18 restore evidence is still present root:root 0600 with hash
  5fef55f248af5cc6fb5318965e38513fde293bd635247384b40f37ef53d829fd.
- Existing alert script and protected Telegram files remain installed. No Telegram
  invocation or acceptance repetition. Retention source includes restic forget:
  do not invoke the production backup script for this task, because forget/prune
  are forbidden. Preserve its existing schedule/implementation.
- Reminder timer disabled/inactive; staging campaign count was not queried due
  to the parser defect, so its earlier disabled evidence is retained separately.
- Available capacity observed 88653496320 bytes (82.57 GiB) on the shared filesystem;
  /var/lib and /tmp are not independent capacity pools.

The first backend classifier recognized only `b2:`. OTHER_OR_DYNAMIC is not a
negative Backblaze finding: B2 can be accessed through an `s3:` locator. Follow-up
classifies the protected locator without printing the URL or credential values.
The current production job contains no staging target/bucket literals, but absence
of a keyword alone does not prove every dynamic include/exclude branch. Its embedded
restic/retention helper logic must be reviewed before deciding whether staging snapshots
can coexist safely in the existing repository. Freshness of the production marker
must never be misrepresented as staging DB/Storage protection.

## Returned V3 catalog — 2026-10-01 17:49:59 Europe/Zagreb

[Unchanged sanitized V3 evidence](evidence/backup-recovery/operator-inventory-v3-20261001.json)
confirms the actual topology. Previous probe failures remain diagnostic history,
not infrastructure failures or successful recovery evidence.

| Cluster / database | Current catalog | Identities / scope |
| --- | --- | --- |
| PG16 main, loopback 5432, `/var/lib/postgresql/16/main`; `passvero` | 10,828,823 bytes; 31 public tables; 17/17 successful migrations, latest `20260822193000_add_auth_foundation`. | Owner/object owner `passvero_migrator`. Runtime app/auth, migrator and backup can CONNECT; test cannot. Installed production backup targets this database. |
| Same main cluster; `passvero_test` | 10,591,255 bytes; 22 public tables; 16/16 successful migrations. | Owner/object owner and CONNECT identity `passvero_test`; app/auth/migrator/backup cannot CONNECT. Test is not a backup identity or a safe restore destination. |
| PG16 acceptance, 127.0.0.1:5433, `/var/lib/postgresql/16/acceptance`; `passvero_acceptance` | 13,720,599 bytes; 51 public tables; 31/31 successful migrations, latest `20260930200000_subscription_reminders`. | Owner/object owner `passvero_migrator`; app/auth/migrator can CONNECT. There is no `passvero_backup` role in this cluster. No source role/grant/password change is proposed. |

Main roles app/auth/migrator/backup/test and acceptance roles app/auth/migrator
are existing LOGIN identities without superuser, CREATEDB, CREATEROLE or BYPASSRLS.
Migrator is an object-owning role in both clusters, not a separate database.
Each cluster also has its administrative `postgres` database. Neither catalog lists
an existing isolated recovery database. Port 55434 has no TCP listener and proposed
workroot `/var/lib/passvero-staging-recovery` is absent; this is availability evidence,
not permission to create a target or proof against every possible unmanaged target.
Creation must still recheck sockets, path/symlinks and cluster inventory.

Acceptance counters include 13 organizations, 117 products, 24 versions, nine passports,
seven Documents, two ProductImageAssets, two ProductImage links, one ProductDocument
link, two campaigns, six outbox records and four attempts. Enabled campaigns are zero;
reminder timer is disabled/inactive. Existing four confirmed receipts, replay additional
sends zero and two stale messages cancelled remain accepted without repetition.

| Referenced storage scope | Records / bytes recorded in DB | Actual byte backup evidence |
| --- | --- | --- |
| Supabase `passvero-staging-documents`, AVAILABLE | 3 / 2,001 bytes; all three have syntactically valid SHA256 values. | Not retrieved or restored in this task. |
| Same bucket, ARCHIVED | 4 / 2,959 bytes; all four have syntactically valid SHA256 values. | Must be retained along with current documents. |
| Supabase `passvero-staging-images`, READY | 2 / 4,144 bytes; both have syntactically valid SHA256 values. | Must include all actually stored historical originals/derivatives and unreferenced objects after full inventory. |

The nine DB-referenced objects total 9,104 recorded bytes. This is not bucket inventory,
a checksum verification or evidence that each referenced object exists. No Storage
calls have run. Installed locator is confirmed **B2 through S3**, not a new destination.
The returned script/cron-name inventory finds only the existing production backup,
freshness and alert scripts and no Passvero backup cron reference in the inspected
locations. Together with the production target, this identifies a staging protection
gap in the inspected existing job; it does not prove absence of every external/manual
snapshot. Read-only repository metadata must check for an existing suitable staging
set before creating a supplementary set.

`backupPythonContract: []` and `freshnessNumericConstants: []` are absent extracted
contracts, not proof of safe retention or a changed threshold. V3 completed SQL,
but its source extractor scans only uppercase Python heredocs; it cannot inspect a
standalone Python module or lowercase heredoc. The installed source hash is unchanged.
A dedicated source-only parser now handles a whole module and arbitrary-case Python
heredocs, redacts unknown string/byte/numeric literals and never executes the source.
Local parser tests PASS; installed semantics await the one-file operator result.
Do not write a staging snapshot into the shared repository until the production
retention filters **and** repository preflight validation are reviewed. Host/tag
separation alone is insufficient: an unfiltered forget can process multiple groups.

## Installed validator contract — 2026-10-01 18:04:04 Europe/Zagreb

[Returned pinned-source evidence](evidence/backup-recovery/operator-source-contract-20261001.json)
contains eight Python blocks from the unchanged installed **shell** backup script.
It does not contain shell control flow or the shell argv passed to restic.
The source-only parser succeeded without executing anything; every call counter is0.

Concrete current constraints, from the returned blocks:

- Lines329–341: every snapshot in the preflight input list must have hostname
  `passvero-production` and contain tag `passvero-postgresql`.
- Lines724–753: post-backup input count must equal pre-count+1; the new snapshot's
  host, exact tag set and exact expected paths are validated.
- Lines889–915: retention dry-run input must have exactly one group, host
  `passvero-production`, and keep the newest snapshot without removing it.
- Lines949–969: final input count must equal pre-count+1-minus-removed; every
  snapshot must again have the production hostname/tag.

These checks can reject a separately tagged staging snapshot **if** their input
is the complete repository rather than a production-filtered list. Production-only
validation is confirmed; unfiltered input is not yet confirmed. Earlier V1 operation
metadata shows snapshots/forget call sites but did not join continued shell lines,
so absence of a filter on one recorded line is not sufficient to decide scope.
Do not infer that default retention grouping makes shared-repository use safe.
Also do not invent a new repository solely because this evidence is incomplete.

One source-only follow-up returns sanitized argument shapes, flags and variable
names for the existing restic statements, including backslash continuations and
non-Python heredoc helpers. It skips the Python bodies already returned. No SQL,
restic, Storage, service/job or Telegram command runs. Local fixtures verify both
filtered/unfiltered calls, continuations, generated helpers and secret redaction.
Unknown literal values remain hidden; ambiguous dynamic scope must remain unresolved.
This is the missing selector layer of the same source review, not a new inventory
or acceptance series. The actual shell source has not been executed.

## Shell selectors reviewed — 2026-10-01 19:03:32 Europe/Zagreb

[Returned selector evidence](evidence/backup-recovery/operator-shell-selectors-20261001.json)
confirms the missing layer. Every operation counter remains0; no source was executed.

| Installed call | Observed selectors | Result for shared repository |
| --- | --- | --- |
| pre/post/final `snapshots`, lines325,712,941 | `--no-cache snapshots --json`, without `--host`, `--tag` or `--path`; only output-file variables appear in those statements. | Input is not limited by production selectors in the shown calls. Combined with the production-only Python validators, a separate staging snapshot can make production backup fail. |
| retention dry-run, lines871–880 | `forget --host … --tag … --group-by host --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --dry-run --json`. | Retention is production-filtered. This does not fix unfiltered pre/post/final validation. |
| retention execution, lines925–932 | Same production host/tag and 14/8/6 policy; no dry-run. | Do not execute the production script for this task. Its established schedule is retained. |
| production upload, lines663–672 | One host, two tags, four artifact inputs: dump, manifest, checksum and TOC. | Identified job captures production PostgreSQL artifacts, not acceptance DB or Storage bytes/configuration. |

**Compatibility decision: do not add a staging snapshot to the existing production
restic repository.** The reason is its observed unfiltered-list/production-only-validator
contract, not a historical NOT_PROVEN label. No production patch, redirected job or
new credential is proposed. No more general inventory or repeat acceptance is needed.
The exact future-operation preflight remains necessary before writing anything.

## Approved operational delta — user confirmation 2026-10-01

The proposal below protects and verifies today's missing staging set while preserving
the existing production system. It explicitly proposes **one separate staging restic
repository namespace** inside the same existing B2 bucket, because sharing the current
production restic repository is incompatible with its validators. The user subsequently approved this exact isolated scope and tightened the pause,
size, writer-closure, fail-safe resume and restore boundaries below.

1. **Exact offsite destination and reuse.** Derive the existing B2 S3 endpoint and
   existing bucket from protected `/etc/passvero/backup/restic-repository` in memory.
   Use the fixed bucket-level prefix `passvero-staging-recovery-v1/`:
   `s3:<same-existing-B2-endpoint>/<same-existing-bucket>/passvero-staging-recovery-v1`.
   This is a distinct restic repository, not merely a new host/tag in production's
   repository. Reuse the installed restic client, protected credentials from
   `/etc/passvero/backup/restic.env` and existing password file
   `/etc/passvero/backup/restic-password` without edits/rotation/new credential files.
   Repository encryption keys created by init are internal repository metadata;
   the existing operator recovery password remains unchanged. No new B2 bucket,
   account, app key, schedule or Telegram integration is added.
   Before init/capture, require read-only permission/collision checks on this exact
   bucket/prefix, safe namespace separation from production's config/data/index/
   locks/keys/snapshots, and an inactive production invocation. If a purpose-matching
   usable staging repository/set already exists there, reuse it and restore its
   adequate current set instead of creating a duplicate. If the prefix contains an
   unrelated repository/data, existing credentials cannot access it, or another
   active writer exists, STOP without init, new keys, policy changes or automatic
   retry. Only an explicitly empty eligible prefix may be initialized. Keep both
   original repository locator file and production repository contents untouched;
   use the staging destination only as a per-process argument/environment value.
   Record production snapshot IDs read-only before/after to establish that the
   supplement did not add/remove snapshots in production's namespace. Never run
   the production backup script. Known B2 prefix restrictions are a preflight gate,
   not permission to broaden the existing key.
2. **Exact sources and consistency.** Read `passvero_acceptance` over the existing
   PostgreSQL socket on 5433 using existing operator peer access, without new source
   roles/grants. Read the complete private buckets `passvero-staging-documents` and
   `passvero-staging-images` using the existing verified staging runtime credentials
   held only in memory. Enumerate every folder with pagination and download actual
   private bytes; do not treat the first page or folder entries as files. Include
   referenced and unreferenced/history objects; do not drop ARCHIVED objects or presume original filename means original bytes exist.
   For a new set, stop only PM2 process `passvero-acceptance` under `passvero-staging`
   after verifying its name/cwd/PID and capturing required non-secret configuration
   and in-memory Storage access. Allow at most a 120-second staging write pause;
   if another writer is present or copying cannot finish in that window, abort the
   set and resume that same process without changing its environment. Export one
   repeatable-read DB snapshot for custom-format pg_dump and the DB count/ACL/storage
   reference manifest. Reconcile full bucket inventory before/after byte copying,
   each required size/SHA256 and DB references. Require no concurrent external
   Storage mutation. Resume staging before offsite transfer. No scan/reminder/mail
   job or campaign is executed. Incomplete sets are retained and never labelled valid.
3. **Minimal configuration include/exclude.** The new set contains the dump, TOC,
   dump SHA256, per-table/migration/catalog/DB-local/default ACL manifest, complete
   bucket object inventory and bytes, byte hashes, and a reviewed non-secret recovery
   configuration manifest. The latter records source/build/lockfile identity from
   `/var/www/passvero-acceptance`, PM2 name/cwd/start command/UID, PG16 version and
   allowlisted effective acceptance PG settings/HBA rules (sources under
   `/etc/postgresql/16/acceptance`), Storage bucket/privacy requirements and scanner/
   qpdf/ClamAV version/configuration requirements. Source/build identity must match
   the selected DB schema. Existing runbooks, backup scripts and unit hashes are
   dependencies, not new copies of production credentials. Do **not** blindly copy
   whole PG configs, PM2 dumps or process environments. Exclude raw `.env*`, pgpass,
   restic.env, restic-password, repository locator values, Telegram token/chat ID,
   password verifiers, private/signing keys and runtime/provider secret values from
   that non-secret configuration manifest. The complete encrypted/protected DB dump
   retains required identity records; it is never printed or committed.
   Recover these independently from the accepted protected escrow procedure into
   their existing required paths; establish availability without revealing values.
   Current staging secret availability and scanner trust/freshness remain explicit
   dependencies. Restoring old scanner-health evidence is not proof of fresh trust.
   The exact minimal set layout is `database/passvero_acceptance.dump`, its `.toc`
   and `.sha256`, `database/manifest.json` (counts/migrations/catalog/ownership/ACL),
   `storage/manifest.json`, actual bytes under `storage/objects/<bucket>/` using
   collision-safe manifest-mapped names, `configuration/runtime.json`,
   `configuration/postgresql.json`, `configuration/scanner.json`,
   `configuration/source.json`, and `recovery-set.json` linking every component.
   Configuration is generated from explicit allowlists; it contains no raw env,
   auth tokens or connection strings with credentials. Runtime allowlist:
   `PASSVERO_RUNTIME_ENV`, `BETTER_AUTH_URL`, credential-free
   `DOCUMENT_STORAGE_SUPABASE_URL`, `DOCUMENT_STORAGE_BUCKET`, the derived image
   bucket, PM2 name/cwd/start-command/UID and DB socket/port/name/role tuple (not URLs).
   Scanner allowlist: `DOCUMENT_SCAN_ENABLED` and the validated fields
   `qpdfLauncherPath`, `qpdfTemporaryRoot`, `clamavSocketPath`, `healthEvidencePath`,
   `malwareSignatures` from `DOCUMENT_SCAN_CONFIG`, plus executable/version hashes.
   PostgreSQL allowlist: server version, port, listen_addresses, server_encoding,
   TimeZone, lc_collate, lc_ctype, max_connections, shared_buffers, ssl, and normalized
   HBA type/database/role/address/auth-method fields without authentication secrets.
   Source allowlist: source/build identifiers, package-lock/runtime versions and
   reviewed artifact hashes. Exclude `DATABASE_URL`, `AUTH_DATABASE_URL`,
   `DOCUMENT_STORAGE_SUPABASE_KEY`, `PASSVERO_TRUSTED_PROXY_SECRET`, every SMTP/B2/
   Telegram credential and any unknown configuration field. URI fields must have
   no userinfo/query/fragment; unexpected fields or embedded credentials mean STOP,
   not copying them into a supposedly non-secret manifest.
4. **Supplement and resource bounds.** Use one operator-only staging capture/validation
   helper and the existing restic client/credentials against only the isolated staging
   prefix. No daemon, timer, cron or deployment hook is added.
   Keep production marker `/var/lib/passvero-backup/state/last-valid-offsite.epoch`
   untouched. At the observed 82.57 GiB free, require at least 4 GiB free for set/download/
   isolated PG files; require total new-set logical payload at most 1 GiB before
   transfer. Current DB size is 13.09 MiB and referenced asset sizes 9,104 bytes;
   dump size, unreferenced objects and actual transfer remain measured quantities,
   not those estimates. Budget at most 1 GiB source Storage download and approximately
   1.1 GiB each for B2 upload and retrieval including repository overhead; record
   actual sizes/transfer and stop if resource bounds cannot be met. Abort if the
   bounds are exceeded; no broader approval is inferred. Allowed repository operations
   are exact-prefix read/check, init only if absent/empty, backup and retrieval. No
   forget/prune/unlock, snapshot deletion or repository cleanup.
   Read back the exact snapshot ID just created, not an ambiguous `latest` or local
   source original. One-off today's protection does not establish recurring staging
   RPO/freshness; existing production daily/hourly/Telegram behavior stays unchanged.
5. **Exact isolated restore.** Because no safe existing target was identified,
   propose one private PG16 cluster under
   `/var/lib/passvero-staging-recovery/restore/<UTC-set-id>/pgdata`, with private socket
   in the same restore directory and no TCP listener; reserve port 55434 as its PG
   identity. Database `passvero_staging_recovery` is only in that new isolated cluster.
   Recreate required source ownership/ACL role names there as NOLOGIN, without source
   passwords or copying global identities. Retain protected retrieved objects in
   `/var/lib/passvero-staging-recovery/retrieved/<full-snapshot-id>/` and restored bytes
   under that restore directory. Root artifacts are 0600 in root-only 0700 subdirectories; PG and isolated-read
   paths belong to postgres in its own 0700 subtree. The workroot may grant traversal
   only to the existing postgres group (root:postgres0710), never general access.
   Verify target path/socket/identity before every restore step. Never use passvero, passvero_test or passvero_acceptance as targets.
   Compare migration checksums, every manifest row count, schema/catalog, ownership,
   DB-local/default ACLs, archive/byte checksums and every required DB reference.
6. **Application read and proof limits.** Use the selected source build in an isolated
   read-only application harness against restored PG and private restored files;
   no public listener, SMTP credentials, mail transport, worker/scheduler startup
   or business writes. Exercise a representative retained product, PDF and image
   through application reads and compare expected references/bytes. Keep existing
   authorization/availability/malware/freshness gates; no bypass or manufactured
   health evidence to obtain PASS. Identify separately any current scanner/trust
   configuration supplied independently of the restored set. A private-file
   storage adapter proves those application reads only: it does not establish a
   Supabase re-upload, provider bucket policies, or full service recovery. Label
   each level separately; full Supabase recovery remains dependent on independent
   provider access and an explicitly approved provider restore target.
7. **Rollback/cleanup.** On failure, resume the same paused staging process if needed;
   stop only the new isolated PG process using its verified data directory. Retain
   snapshot, fixtures, set/download/restore directories and sanitized evidence.
   No automatic cleanup, source-data rewrite, snapshot removal or secrets change.
   Cleanup requires a separately specified exact-path approval. Reminder timer and
   campaigns stay disabled throughout; no email or extra Telegram message.

The bounded read-only review is complete. The user explicitly **APPROVED** the
isolated staging prefix, existing credentials, entire private buckets, minimal non-secret
configuration, one staging pause up to 120 seconds, maximum 1 GiB set, minimum 4 GiB
free and new private PG16 target. No repeated approval is needed within those limits.
The operator still executes every privileged block and returns sanitized output;
Codex does not execute sudo. Rights failure, namespace conflict, unknown writers or
size/deadline failure means STOP, never wider scope or automatic retries.

## Approved execution checkpoint — preparation pending

Current reviewed source is `scripts/staging-recovery/prepare.py` (SHA256
`d519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473` after the verified restic-path correction below). The original
preparation handoff/source hash is retained as historical evidence.
The [complete VPS block](../docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md)
is **PENDING_OPERATOR_COMMAND_PREPARATION**. It installs only that pinned helper
under the new protected workroot and executes preparation while staging stays online.
It checks existing credentials in memory, exact B2 prefix accessibility/identity,
current source/gates, recursively inventories both entire private buckets, downloads
all listed actual bytes, and measures a separate acceptance dump. Existing nonempty
repositories must have compatible format and staging snapshot identity; conflicts,
unknown destination and denied access stop without widening rights.

Preparation is not a consistent recovery set: application writers remain online.
Its files are retained privately for the subsequent approved capture. No repository
init/upload, pause, restore or live configuration change runs in this block. Existing
snapshots, if any, are reviewed for current-set reuse before making another capture.
The later pause must use an independent app-resume watchdog, prove writer closure,
finish within 120 seconds without extension/retry and resume staging before B2 transfer.
These later safeguards are requirements, **not implemented/live-proven by preparation**.

Ten local Python tests PASS, including full mocked preparation, denied B2 access,
complete pagination/history, invalid scope, resource budgets, credential grammar and
redirect rejection. Source and embedded installer parse and match the pinned hash.
Local tests do not prove current provider permissions, bucket bytes or recovery.
Application tests/build are not repeated for this Python operator preparation change.

No fresh operational result has been supplied after approval. Actual set ID, bucket
counts/bytes, prefix identity, capture pause, B2 snapshot, restore validation and final
staging/restore-cluster state remain pending operator output. Last observed reminder
gates are disabled/inactive and zero enabled campaigns; preparation rechecks them.
Four confirmed receipts, replay zero additional sends and two stale cancellations
remain accepted. This is a **one-off** recovery series; no automatic staging backup
schedule, freshness rule or Telegram integration is created.

Current documentation checks use the Supabase skill. The markdown changelog index
could not be fetched through the available web reader; local curl also lacked DNS.
The official HTML changelog and current Storage listing docs were read instead;
no SDK upgrade, schema/RLS change or new provider resource is needed for the proposal.
Private server-side keys, read-only Storage access, no public URLs/policies and no
provider auth changes are preserved.

Technical references supporting the proposed implementation details:
[restic S3 repository paths/password files](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html),
[B2 application-key prefix limits](https://www.backblaze.com/docs/cloud-storage-application-keys),
[Supabase Storage listing/pagination and folder entries](https://supabase.com/docs/reference/javascript/storage-from-list),
[official current changelog](https://supabase.com/changelog).
These references do not prove permissions or content on the user's existing bucket;
those exact-prefix checks belong to the approved operation's preflight.

## Returned inventory refresh — 2026-10-01 20:25:29 Europe/Zagreb

[Sanitized returned JSON](evidence/backup-recovery/operator-inventory-refresh-20261001T182529Z.json)
is an earlier inventory-format `READ_ONLY_COMPLETE`, **not** the requested
`preparation=PASS/STOP` result. No `setId`, B2 exact-prefix result, full Storage
inventory/byte counts or measured dump is present. Do not infer that the preparation
helper ran, a consistent set exists or current B2 recovery is proven.

It confirms the unchanged installed production script hash, retained offsite/restore
evidence, daily/hourly timers enabled/active, reminder timer disabled/inactive and
zero reported writes/email/Telegram. Freshness service has a real successful invocation
at 20:00 CEST, exit0. The existing production marker age is58629 seconds at20:25,
still within the documented93600-second threshold; available space is88658350080 bytes.
These fresh observations supplement accepted evidence without a new Telegram test.
Its partial/null cluster fields and `OTHER_OR_DYNAMIC` destination classification
are limitations of that former inventory format; they do not supersede the accepted
V3 catalog and later installed source/selector contract.

No broad inventory rerun or new diagnostic series is needed. The same approved,
hash-pinned preparation block remains pending. Only its sanitized PASS/STOP result
can determine whether to proceed with the one bounded consistent capture.

## Preparation STOP received — bounded dependency review

[Returned sanitized result](evidence/backup-recovery/operator-preparation-stop.json):
`phase=B2_EXACT_PREFIX_READ_ONLY`, `reason=FileNotFoundError`, pause not requested,
remote writes0, SMTP0, Telegram0, artifacts retained, manual review required.
The preparation passed its preceding runtime/DB/gates branch; do not infer later
Storage downloads, dump measurement, B2 identity success or a consistent recovery set.

This phase opens exactly the three existing protected repository/password/environment
files and invokes the hardcoded `/usr/bin/restic` for read-only repository commands.
Previously returned metadata showed the protected files present; a different installed
restic path is a concrete hypothesis, not yet a confirmed root cause. No dependency
installation, secret recreation, permission change or automatic preparation rerun is
proposed. The new narrow read-only block checks only those paths, existing restic
resolution and the pinned production source hash. It reads no secret values and invokes
no restic/B2/DB/Storage/job/app operations. Four local metadata fixtures and syntax PASS.

The console also shows Markdown/explanatory text interpreted by bash after the helper
result (`json`/sample-result text treated as commands). This is a separate handoff issue,
not evidence for the FileNotFoundError root cause. The next short block is provided
directly in chat as a single shell code block; copy only its contents, never headings,
Markdown fences, explanations or expected-output examples. Do not rerun preparation.

**PENDING_OPERATOR_COMMAND_PREPARATION_DEPENDENCIES.** Await sanitized dependency
output, then make only the verified existing-client correction if needed. The approved
capture/B2/restore scope and limits remain unchanged; pause has not been consumed,
no repository/restore target was created by the preparatory code, and no automatic
staging schedule is introduced. Production and accepted delivery evidence remain retained.

## Dependency root cause confirmed — one existing-client correction

[Returned dependency result](evidence/backup-recovery/operator-preparation-dependencies.json)
confirms all three protected inputs root-owned0600, unchanged production source pin,
missing `/usr/bin/restic` and existing `/usr/local/bin/restic` root-owned0755 executable.
The preparation helper's fixed client path caused FileNotFoundError. Credentials,
provider permissions and production validators are not changed to resolve it.

The only source correction is `/usr/bin/restic` → `/usr/local/bin/restic` in the
operator helper. A regression fixture reproduced FileNotFoundError before this fix;
all11 local tests pass after it. The complete corrected source is exactly the old
pinned bytes with that single replacement, new SHA256
`d519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473`. The short operators' handoff verifies old/new hashes and
private-path identity/posture, creates a new exclusive versioned helper, retains the
old helper/artifacts and invokes corrected preparation once. No installer, new binary,
package/dependency, permission widening, config edit or production source change.
Local syntax and full handoff fixture PASS; no privileged command executed by Codex.

**PENDING_OPERATOR_COMMAND_REPAIR_EXISTING_RESTIC_AND_PREPARATION.** Manual review
is complete for this cause; the explicitly invoked corrected preparation is the affected
step permitted by the existing task, not an automatic retry. It performs exact-prefix
read-only checks, protected Storage byte preparation and DB dump measurement while
staging remains online. A new STOP requires review, not a loop or permission expansion.
The one approved bounded pause is still unused, no current consistent set/B2 snapshot/
restore proof is claimed, and no automatic staging schedule is added. Await actual
corrected preparation output before proceeding with capture/B2/isolated restore.

## Corrected preparation PASS — set 20261001T190516Z

[Returned repair/preparation output](evidence/backup-recovery/operator-preparation-pass-20261001T190516Z.json)
confirms existing restic-path repair PASS and successful preparation. Staging stayed
ONLINE_UNPAUSED; no remote writes/email/Telegram, existing artifacts retained. The exact
approved prefix is readable and empty (repositoryExists=false, existingStagingSnapshots0);
this does not yet prove B2 write rights or establish a new repository/snapshot.

Both entire private bucket inventories yielded5 stored objects/6145 bytes, downloaded
and hashed privately by the helper. Measured DB dump584515 bytes; total measured
source payload590660 bytes (configuration/manifests still to be added), free88657485824B.
Size/space preparation passes; no 120-second pause consumed. Prepared bytes/dump remain
**not a consistent recovery set**; no B2 transfer or isolated restore occurred.

The5 objects/6145B equal earlier AVAILABLE PDFs2001B plus READY images4144B.
V3 also had4 ARCHIVED Documents/2959B. Existing accepted cleanup proves3 exact
acceptance Documents for run80365265-5090-4d8e-88c5-327897caed67 and the750B PDF
fb953a8d-5f0b-4677-8330-fd3004533013 for run150b0aaa-f3f4-4ed5-894e-7d66083c3a2e
were intentionally archived and their exact Storage objects removed. Reuse this
accepted history; do not rerun cleanup or pretend those absent bytes were backed up.

Before the only approved pause, `scripts/staging-recovery/reference_preflight.py`
(SHA256 `2c45d84089e9960681b3318fa4ed2d5c3021eb2453aad70737ef6d69404ae376`) reconciles current DB references against
all prepared byte checksums. Known prior-cleanup missing objects require ARCHIVED,
archive timestamp, same creator/archive/update actor, zero links, retained audits,
terminal scan state and the accepted run marker; the later PDF additionally requires
its exact ID/750B/SHA256/CLEAN/policy2 identity. Unknown missing retained/history
objects, extra cleanup claims, image absence, byte mismatches or wrong bucket/provider
mean STOP before any pause. Actual stored historical/orphan objects stay included.

19 local tests PASS (11 preparation +8 reference cases), including missing required
history, checksum/size mismatch and known cleanup exceptions; Python syntax PASS.
Operator preflight writes only a new protected references/evidence file under the
existing preparation directory. SQL uses the existing peer operator identity on5433
in READ ONLY; no provider/job/app invocation, upload, email or deletion. It is not
consistent capture and its DB reference result must be rechecked under capture locks.
**PENDING_OPERATOR_COMMAND_REFERENCE_PREFLIGHT**; if it passes, proceed within the
existing approval to independently guarded, bounded writer-closed capture. No new
staging schedule/freshness/Telegram behavior is established by this preparation.

## Reference PASS; guarded capture pending

[Returned reference output](evidence/backup-recovery/operator-reference-preflight-pass-20261001T190516Z.json)
confirms9 DB asset references,5 stored-byte matches,4 accepted cleanup tombstones,
2959 previously removed bytes and0 unreferenced objects. No pause/remote write/email/
Telegram call; the preparation and reference checks are accepted, not rerun.

Added only the operator capture helper and its focused synthetic tests. Source SHA256
`0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865`.34 local tests pass (11 preparation,8 references,15 capture/guard), including
same-snapshot dump/count/catalog references, failing unknown DB clients/changed remote
bytes, exporter release, one-pause replay refusal and exact staging-only PM2 RPC calls.
No live PG/PM2/systemd/Storage/B2 command was executed by Codex. Replaced a potential
PM2 CLI daemon-spawn race with existing-daemon RPC, no environment update; table counts
use json_object_agg rather than102 function arguments. Prepared complete hash-pinned
installer/clipboard handoff; old operator files and all artifacts retained.

The capture operation verifies an actual timeout/post-stop callback without pausing
staging first. Its independent Type=exec transient unit hard-limits capture85s and
resume25s; no timer/job restart or automatic retry. The core checks daemon/runtime,
51 locked public tables, no outside source DB clients (refreshed session-statistics cache) or prepared transactions,
pending workflow absence and whole private Storage inventory/byte stability. One
repeatable-read exported snapshot connects the dump,31 migrations,counts/catalog/ACL
and current references. SHARE locks occur before the first SELECT. The Storage proof
is observed staging writer closure plus metadata/byte stability, not a provider-wide
lock or policy change. Resume verifies the same app/runtime and port3001; linked
nonsecret config/DB/Storage checksums are finalized after resume. Payload≤1GiB and
free≥4GiB checked again; approved pause≤120s measured. Exclusive claim prevents a
second pause; a failure retains evidence and requires manual review.

[Complete operator blocks and emergency resume](../docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md)
are ready at **PENDING_OPERATOR_COMMAND_GUARDED_CAPTURE**. The actual systemd guard,
consistent capture and staging closure remain NOT_YET_RUN until returned output.
No B2 repository write or isolated restore cluster was created. Transfer/retrieve/
restore are the remaining approved steps. This one-off operation introduces no
automatic staging backup/freshness/Telegram schedule. Production schedule/source/
retention/reporting stay unchanged. Reminder timer and campaigns remain off; four
confirmed email receipts, replay0 extra sends and two stale cancellations are retained.

Implementation references: [systemd service execution](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.service.xml),
[systemd exit signal names](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.exec.xml),
[PostgreSQL16 lock/snapshot ordering](https://www.postgresql.org/docs/16/sql-lock.html),
[existing PM2 daemon actions](https://raw.githubusercontent.com/Unitech/pm2/master/lib/God/ActionMethods.js),
[PG16 session statistics refresh](https://www.postgresql.org/docs/16/monitoring-stats.html).
Installed PM2 action-file posture/signatures/hash are checked before the pause; primary
upstream source does not replace live compatibility/guard evidence.

## Capture handoff installation state — operator output retained

[Returned shell/helper state](evidence/backup-recovery/operator-capture-helper-state.json)
confirms prepare installed/private/hash-matched, references and capture helpers absent,
no one-pause claim, and no listed transient capture/guard units. This is not successful
capture evidence or a reason to repeat preparation/reference acceptance. The current
complete VPS installer is now formatted with short adjacent Base64 literal lines;
the decompressed helper bytes and source hashes are unchanged.34 local tests still
PASS, including full embedded installer and exact clipboard/source matching.
The direct VPS copy/paste block installs the two reviewed missing helpers, verifies
existing preparation/root identity and then launches the single bounded capture.
PENDING_OPERATOR_COMMAND_GUARDED_CAPTURE; no operational command run by Codex,
no staging pause/B2 write/restore or email/Telegram claim. Await actual output.

## Consistent capture failure — closed and verified; one additional pause proposed

[Returned read-only closure evidence](evidence/backup-recovery/operator-capture-failure-complete-20261001T203612Z.json)
confirms set20261001T203612Z failed at LOCK_AND_EXPORT_SNAPSHOT/SQL_RESULT_SHAPE.
Independent timeout test passed; actual failure ExecStopPost resumed staging in
2.743s. Returned current PM2/port3001 check passes. Timer disabled/inactive, reminder
service inactive and campaigns0. Original claim and failure artifacts retained;
no dump/database/storage/recovery manifests, remote writes/SMTP/Telegram0. No current
consistent recovery set/B2 transfer/restore is proven. Read-only diagnostic is complete,
not pending; do not repeat accepted synthetic formatter or guard acceptance.

Root cause is verified locally and on PG16: one valid composite json_agg JSON value
spans two physical lines. The original Snapshot.q incorrectly required one nonempty
line. The corrected parser decodes the entire sentinel-framed value once, keeps the
32MiB bound and rejects multiple SQL values. The parser-only correction was locally
reviewed at SHA73f8bbb79e493fe82ab61036dd2d5b7340b666ee37683c4dd6d68a3070a8c493;
it was not deployed. Current source also prepares an explicit, separately gated
continuation after this exact failed set. Original ordinary launcher still rejects
its consumed claim; a new exclusive additional claim preserves/binds the first claim.
Actual capture transaction, PM2 control, deadlines and resume remain unchanged.

The **concrete plan and reviewed draft full VPS block** are in the runbook's
[additional-pause proposal](../docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md#historical-additional-capture-handoff--installer-stopped-do-not-rerun).
Only one additional staging pause at most120s requires new permission, because the
user approved one pause and no automatic retry. Fresh read-only source/Storage/space
checks and a bounded current measurement dump occur while staging remains online.
At least4GiB free and final payload<=1GiB remain required (128MiB headroom reserved).
Reuse accepted guard proof, check new applied unit properties, then85s capture+25s
independent resume. New exclusive set/control paths; old claim/set never reset,
overwritten or deleted. The additional claim permits no repeat after any failure.

Already approved unchanged B2 prefix/credentials and private socket-only PG16 restore
remain in scope after a successful set/resume; no reapproval of those is requested.
Remote transfer/download are after resume, and exact snapshot DB/bytes/reference/app
proof remains pending. Any rights/identity/limit conflict means STOP, no expansion.
No schedule/production/freshness/Telegram/secret/live scanner change or automatic
cleanup. Four confirmed receipts, replay0 and stale cancellations2 are preserved.

Current source SHA `d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa`, NOT_DEPLOYED. Local tests42/42 (11 preparation,
8 references,23 capture); source/synthetic fixtures are not live recovery evidence.
Draft installer is complete and hash-pinned, with short paste lines and no Mac detour.
User explicitly approved the one additional pause using the current hash-pinned
helper and unchanged85s/25s bounds. PENDING_OPERATOR_COMMAND_ADDITIONAL_CAPTURE;
no new operator command, pause, B2 or restore has been executed. Earlier preparation/checkpoint sections above are retained history.

## Recovery proof still to be completed in this task

For a selected current recovery set, retrieve the actual encrypted B2 copy; verify
archive checksum/readability, current migrations/catalog/ACL and manifest counts;
restore the required files and reconcile sizes/SHA256/DB references. Read representative
product/PDF/image through an isolated application with email/jobs disabled. A private
filesystem-only byte restore must be labelled as such; it does not prove Supabase upload
or complete application recovery. The missing staging delta and isolated destination are specified above. No staging
recovery PASS or recurring staging freshness/RPO is claimed before actual proof.

Existing test/staging/production data, snapshots, retention, schedule, Telegram and
reminder sending gates are preserved. Failed restore artifacts remain for diagnosis.
Cleanup is a separately specified exact-path operation; no automatic deletion.

References: [PostgreSQL DR runbook](../docs/superpowers/runbooks/passvero-postgresql-disaster-recovery.md),
[Stage 13B completion](../docs/superpowers/reviews/2026-08-24-stage13b-auth-foundation-completion.md),
[accepted restore/governance](../docs/superpowers/governance/2026-08-18-single-operator-recovery-exception.md),
[historical backup reconciliation](SUBSCRIPTION_COMMERCIAL_CONTRACT_AND_BACKUP_SCOPE_RECONCILIATION.md),
[current reminders evidence](SUBSCRIPTION_REMINDERS_AND_DELIVERY_STAGING_ACCEPTANCE.md).

PRODUCTION_CHANGES=NONE; CAPTURE_ATTEMPT=STOP_STAGING_RESUMED; B2_TRANSFER_RESTORE=NOT_RUN; RESTIC_ACTIVITY=READ_ONLY_PREPARATION;
SMTP_CALLS=0; TELEGRAM_CALLS=0; COMMIT_CREATED=NO; PUSH_CREATED=NO;
SHARED_PRODUCTION_REPOSITORY_FOR_STAGING=REJECTED_BY_INSTALLED_CONTRACT;
OPERATIONAL_PLAN=APPROVED; OPERATIONAL_COMPLETION=PENDING_OPERATOR_COMMAND_APPROVED_CAPTURE_DELTA; ADDITIONAL_PAUSE_APPROVAL=USER_APPROVED_ONCE_UNUSED_CONFIRMED;
AUTOMATIC_STAGING_BACKUP_SCHEDULE=NOT_INTRODUCED.
