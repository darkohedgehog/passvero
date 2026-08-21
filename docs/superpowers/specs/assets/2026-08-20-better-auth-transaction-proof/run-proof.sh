#!/bin/bash
set -euo pipefail
umask 077

PROOF_PORT=55432
PG_BIN=/opt/homebrew/opt/postgresql@16/bin
NODE_BIN=/opt/homebrew/bin/node
NPM_BIN=/opt/homebrew/bin/npm
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd -P)"
HARNESS_SOURCE="$SCRIPT_DIR/harness"
SENTINEL_CONSTANT=PASSVERO_STAGE13A_PG_V1
RUN_ROOT=""
RUN_ROOT_REAL=""
CLEANUP_REQUIRED=0
ROOT_ALLOCATION_UNCERTAIN=0
ATTEMPT_STATE="$SCRIPT_DIR/.proof-attempt-state"
FAILURE_MATERIAL="$ATTEMPT_STATE/failure-material"
PREPARED_EVIDENCE="$ATTEMPT_STATE/prepared"
ATTEMPT_LOG="$ATTEMPT_STATE/logs/orchestration.log"
ATTEMPT_LOG_OPEN=0
PHASE=UNCLAIMED
POSTMASTER_PROVEN=0
FULL_IDENTITY_PROVEN=0
PENDING_READY=0
PREPARED_READY=0
CLEANUP_ACTIVE=0
SIGNAL_STATUS=0
PUBLICATION_CHILD_PID=""
PUBLICATION_CHILD_OWNER_SHELL_PID=""
PUBLICATION_CHILD_ACTIVE=0
PUBLICATION_CHILD_TRUSTED=0

die() {
  printf '%s\n' "$1"
  exit 1
}

record_cleanup_signal() {
  local status="$1"
  if [[ "$SIGNAL_STATUS" -eq 0 ]]; then SIGNAL_STATUS="$status"; fi
}

cleanup_checkpoint() {
  local checkpoint="$1"
  if [[ "${PASSVERO_PROOF_SOURCE_ONLY:-0}" == 1 \
    && "${PASSVERO_PROOF_STATIC_INJECT:-}" == "SIGNAL_$checkpoint" ]]; then
    record_cleanup_signal 130
  fi
}

request_signal_failure() {
  local status="$1"
  record_cleanup_signal "$status"
  if [[ "$PUBLICATION_CHILD_ACTIVE" -eq 1 ]]; then
    terminate_publication_child || true
    return
  fi
  if [[ "$CLEANUP_ACTIVE" -eq 0 ]]; then exit "$status"; fi
}

terminate_publication_child() {
  local child_pid="$PUBLICATION_CHILD_PID"
  [[ "$PUBLICATION_CHILD_ACTIVE" -eq 1 && "$PUBLICATION_CHILD_TRUSTED" -eq 1 ]] || return 1
  [[ "$PUBLICATION_CHILD_OWNER_SHELL_PID" == "$$" ]] || return 1
  [[ "$child_pid" =~ ^[1-9][0-9]*$ ]] || return 1
  kill -TERM -- "$child_pid" >/dev/null 2>&1 || true
}

require_mode() {
  [[ $# -eq 1 ]] || die "STOP_ARGUMENT_INVALID"
  case "$1" in
    --static|--all) ;;
    *) die "STOP_ARGUMENT_INVALID" ;;
  esac
}

validate_static_root() {
  local candidate="$1"
  [[ "$candidate" =~ ^/private/tmp/passvero-stage13a-harness\.[A-Za-z0-9]+$ ]] || return 1
  [[ ! -L "$candidate" && -d "$candidate" ]] || return 1
  [[ "$(cd "$candidate" && pwd -P)" == "$candidate" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$candidate")" == "$(id -u):700" ]] || return 1
}

static_cleanup() {
  local candidate="$1"
  validate_static_root "$candidate" || die "STOP_STATIC_ROOT_RETAINED"
  rm -rf -- "$candidate"
  [[ ! -e "$candidate" ]] || die "STOP_STATIC_ROOT_RETAINED"
}

run_source_gate() {
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" \
    "$NODE_BIN" --test \
    "$REPOSITORY_ROOT/tests/auth-foundation-transaction-proof-source.test.mjs" \
    "$REPOSITORY_ROOT/tests/auth-foundation-transaction-proof-artifacts.test.mjs"
}

run_static() {
  local static_root
  run_source_gate
  bash "$SCRIPT_DIR/static-shell-simulations.sh" "$SCRIPT_DIR/run-proof.sh"
  static_root="$(mktemp -d /private/tmp/passvero-stage13a-harness.XXXXXX)"
  chmod 0700 "$static_root"
  cp -R "$HARNESS_SOURCE/." "$static_root/"
  mkdir -m 0700 "$static_root/cache" "$static_root/tmp"
  install -m 0600 /dev/null "$static_root/npmrc"
  if ! env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$static_root/tmp" \
    XDG_CACHE_HOME="$static_root/cache" npm_config_cache="$static_root/cache" \
    npm_config_userconfig="$static_root/npmrc" NODE_OPTIONS="--no-warnings" \
    "$NPM_BIN" ci --ignore-scripts --no-audit --no-fund --loglevel=error --prefix "$static_root"; then
    static_cleanup "$static_root"
    return 1
  fi
  if ! (cd "$static_root" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$static_root/tmp" \
    XDG_CACHE_HOME="$static_root/cache" npm_config_cache="$static_root/cache" \
    npm_config_userconfig="$static_root/npmrc" NODE_OPTIONS="--no-warnings" \
    "$NODE_BIN" --import tsx --test --test-concurrency=1 test/*.test.ts); then
    static_cleanup "$static_root"
    return 1
  fi
  if ! (cd "$static_root" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$static_root/tmp" \
    XDG_CACHE_HOME="$static_root/cache" npm_config_cache="$static_root/cache" \
    npm_config_userconfig="$static_root/npmrc" NODE_OPTIONS="--no-warnings" \
    "$NODE_BIN" node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 \
    --module NodeNext --moduleResolution NodeNext --skipLibCheck \
    src/evidence.ts src/auth.ts src/run-root.ts src/lifecycle.ts src/proof-boundary.ts \
    test/cluster-identity.test.ts test/native-transaction.test.ts test/direct-boundary.test.ts test/handler-boundary.test.ts \
    test/controlled-activation.test.ts test/session-boundary.test.ts \
    test/recovery-boundary.test.ts test/route-boundary.test.ts); then
    static_cleanup "$static_root"
    return 1
  fi
  static_cleanup "$static_root"
  printf '%s\n' "STATIC_PROOF=PASS"
}

open_attempt_log() {
  [[ "$ATTEMPT_LOG" == "$ATTEMPT_STATE/logs/orchestration.log" ]] || return 1
  [[ ! -L "$ATTEMPT_LOG" && -f "$ATTEMPT_LOG" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$ATTEMPT_LOG" 2>/dev/null)" == "$(id -u):600" ]] || return 1
  exec 9>>"$ATTEMPT_LOG" 2>/dev/null || return 1
  ATTEMPT_LOG_OPEN=1
}

preflight_port() {
  if /usr/sbin/lsof -nP -iTCP:${PROOF_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
    die "STOP_PORT_IN_USE"
  fi
  set +e
  "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PROOF_PORT" -q >/dev/null 2>&1
  local ready_status=$?
  set -e
  [[ "$ready_status" -eq 2 ]] || die "STOP_PORT_IN_USE"
}

preflight_attempt_artifacts() {
  local candidate
  for candidate in \
    "$ATTEMPT_STATE" \
    "$SCRIPT_DIR/evidence.pending.json" \
    "$SCRIPT_DIR/evidence.json" \
    "$SCRIPT_DIR/evidence.md"; do
    [[ ! -e "$candidate" && ! -L "$candidate" ]] || die "STOP_EXECUTION_ATTEMPT_EXISTS"
  done
  local retained_root
  retained_root="$(find /private/tmp -maxdepth 1 -name 'passvero-stage13a-pg.*' -print -quit)"
  [[ -z "$retained_root" ]] || die "STOP_EXECUTION_ATTEMPT_EXISTS"
}

run_static_preflight() {
  local preflight_root preflight_log static_status
  preflight_root="$(mktemp -d /private/tmp/passvero-stage13a-preflight.XXXXXX)"
  chmod 0700 "$preflight_root"
  preflight_log="$preflight_root/static.log"
  install -m 0600 /dev/null "$preflight_log"
  set +e
  run_static >"$preflight_log" 2>&1
  static_status=$?
  set -e
  [[ "$preflight_root" =~ ^/private/tmp/passvero-stage13a-preflight\.[A-Za-z0-9]+$ ]] \
    && [[ ! -L "$preflight_root" && -d "$preflight_root" ]] \
    && [[ "$(cd "$preflight_root" && pwd -P)" == "$preflight_root" ]] \
    && [[ "$(stat -f '%u:%Lp' "$preflight_root")" == "$(id -u):700" ]] \
    || die "STOP_STATIC_ROOT_RETAINED"
  rm -rf -- "$preflight_root"
  [[ ! -e "$preflight_root" ]] || die "STOP_STATIC_ROOT_RETAINED"
  [[ "$static_status" -eq 0 ]] || die "STOP_STATIC_GATE"
}

claim_attempt() {
  trap cleanup EXIT
  trap 'request_signal_failure 130' INT
  trap 'request_signal_failure 143' TERM
  if ! env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" \
    "$NODE_BIN" "$HARNESS_SOURCE/src/publication.mjs" claim "$SCRIPT_DIR" >/dev/null 2>&1; then
    die "STOP_EXECUTION_ATTEMPT_EXISTS"
  fi
  open_attempt_log || die "STOP_ATTEMPT_LOG_INVALID"
  PHASE=CLAIMED
}

prearm_root_allocation() {
  RUN_ROOT=""
  RUN_ROOT_REAL=""
  CLEANUP_REQUIRED=1
  ROOT_ALLOCATION_UNCERTAIN=1
  PHASE=ROOT_ALLOCATION_PENDING
}

allocate_run_root() {
  local allocation_state="$ATTEMPT_STATE/root-allocation.path" allocated_root
  [[ ! -e "$allocation_state" && ! -L "$allocation_state" ]] || return 1
  install -m 0600 /dev/null "$allocation_state" >&9 2>&1 || return 1
  if [[ "${PASSVERO_PROOF_SOURCE_ONLY:-0}" == 1 \
    && "${PASSVERO_PROOF_STATIC_INJECT:-}" == SIGNAL_BEFORE_MKTEMP ]]; then
    kill -TERM "$$"
    return "$SIGNAL_STATUS"
  fi
  mktemp -d /private/tmp/passvero-stage13a-pg.XXXXXX 2>&9 3>"$allocation_state" >&3 || return 1
  if [[ "${PASSVERO_PROOF_SOURCE_ONLY:-0}" == 1 \
    && "${PASSVERO_PROOF_STATIC_INJECT:-}" == AFTER_MKTEMP_BEFORE_ASSIGNMENT ]]; then return 97; fi
  allocated_root="$(protected_value "$allocation_state" 2>&9)" || return 1
  RUN_ROOT="$allocated_root"
  [[ "$RUN_ROOT" =~ ^/private/tmp/passvero-stage13a-pg\.[A-Za-z0-9]+$ ]] || die "STOP_RUN_ROOT_INVALID"
  [[ ! -L "$RUN_ROOT" && -d "$RUN_ROOT" ]] || die "STOP_RUN_ROOT_INVALID"
  [[ "$(cd "$RUN_ROOT" 2>&9 && pwd -P 2>&9)" == "$RUN_ROOT" ]] || die "STOP_RUN_ROOT_INVALID"
  [[ "$(stat -f '%u:%Lp' "$RUN_ROOT" 2>&9)" == "$(id -u):700" ]] || die "STOP_RUN_ROOT_INVALID"
  ROOT_ALLOCATION_UNCERTAIN=0
  PHASE=ROOT_ALLOCATED
  unlink "$allocation_state" >&9 2>&1 || return 1
}

bootstrap_root() {
  prearm_root_allocation
  local allocation_status
  allocate_run_root || { allocation_status=$?; return "$allocation_status"; }
  if [[ "${PASSVERO_PROOF_SOURCE_ONLY:-0}" == 1 \
    && "${PASSVERO_PROOF_STATIC_INJECT:-}" == AFTER_MKTEMP ]]; then return 97; fi
  chmod 0700 "$RUN_ROOT" >&9 2>&1
  RUN_ROOT_REAL="$(cd "$RUN_ROOT" 2>&9 && pwd -P 2>&9)"
  [[ "$RUN_ROOT_REAL" == "$RUN_ROOT" ]] || die "STOP_RUN_ROOT_INVALID"
  PHASE=ROOT_CREATED
  cp -R "$HARNESS_SOURCE" "$RUN_ROOT_REAL/harness" >&9 2>&1
  chmod 0700 "$RUN_ROOT_REAL/harness" >&9 2>&1
  mkdir -m 0700 "$RUN_ROOT_REAL/harness/cache" "$RUN_ROOT_REAL/harness/tmp" >&9 2>&1
  install -m 0600 /dev/null "$RUN_ROOT_REAL/harness/npmrc" >&9 2>&1
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    "$NPM_BIN" ci --ignore-scripts --no-audit --no-fund --loglevel=error --prefix "$RUN_ROOT_REAL/harness" \
    >&9 2>&1
  (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" \
    TMPDIR="$RUN_ROOT_REAL/harness/tmp" XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" \
    npm_config_cache="$RUN_ROOT_REAL/harness/cache" npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" \
    NODE_OPTIONS="--no-warnings" PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" \
    "$NODE_BIN" --import tsx \
    "$RUN_ROOT_REAL/harness/src/run-root.ts" bootstrap "$RUN_ROOT_REAL") >&9 2>&1
  PHASE=IDENTITY_CREATED
}

protected_value() {
  local file="$1"
  [[ ! -L "$file" && -f "$file" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$file")" == "$(id -u):600" ]] || return 1
  local value
  value="$(<"$file")"
  [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* ]] || return 1
  printf '%s' "$value"
}

start_cluster() {
  local superuser_role
  superuser_role="$(protected_value "$RUN_ROOT_REAL/identity/superuser-role" 2>&9)" || die "STOP_IDENTITY_INVALID"
  [[ "$superuser_role" =~ ^pvproof_admin_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    "$PG_BIN/initdb" -D "$RUN_ROOT_REAL/data" --encoding=UTF8 --locale=C \
    --username="$superuser_role" --auth-local=scram-sha-256 --auth-host=scram-sha-256 \
    --pwfile="$RUN_ROOT_REAL/identity/superuser-password" >&9 2>&1
  PHASE=DATA_INITIALIZED
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    "$PG_BIN/pg_ctl" -D "$RUN_ROOT_REAL/data" -l "$RUN_ROOT_REAL/log/postgres.log" \
    -o "-h 127.0.0.1 -p 55432 -k $RUN_ROOT_REAL/socket -c listen_addresses=127.0.0.1 -c unix_socket_permissions=0700" start \
    >&9 2>&1
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" "$NODE_BIN" -e 'const fs=require("fs");const [source,target]=process.argv.slice(1);const pid=fs.readFileSync(source,"utf8").split("\n",1)[0];if(!/^\d+$/.test(pid))process.exit(72);fs.writeFileSync(target,pid,{mode:0o600,flag:"wx"})' \
    "$RUN_ROOT_REAL/data/postmaster.pid" "$RUN_ROOT_REAL/identity/postmaster-pid" >&9 2>&1
  prove_partial_postmaster >&9 2>&1 || die "STOP_CLUSTER_IDENTITY"
  POSTMASTER_PROVEN=1
  PHASE=POSTMASTER_STARTED
}

create_disposable_database() {
  local superuser_role application_role database
  superuser_role="$(protected_value "$RUN_ROOT_REAL/identity/superuser-role" 2>&9)" || die "STOP_IDENTITY_INVALID"
  application_role="$(protected_value "$RUN_ROOT_REAL/identity/application-role" 2>&9)" || die "STOP_IDENTITY_INVALID"
  database="$(protected_value "$RUN_ROOT_REAL/identity/database" 2>&9)" || die "STOP_IDENTITY_INVALID"
  [[ "$superuser_role" =~ ^pvproof_admin_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  [[ "$application_role" =~ ^pvproof_app_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  [[ "$database" =~ ^pvproof_test_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    PGPASSFILE="$RUN_ROOT_REAL/identity/superuser-pgpass" \
    "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PROOF_PORT" \
    -U "$superuser_role" -d postgres -v app_role="$application_role" -v database="$database" \
    -f "$RUN_ROOT_REAL/sql/cluster-bootstrap.sql" -f "$RUN_ROOT_REAL/sql/role-password.sql" >&9 2>&1
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    PGPASSFILE="$RUN_ROOT_REAL/identity/application-pgpass" \
    "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PROOF_PORT" \
    -U "$application_role" -d "$database" -f "$RUN_ROOT_REAL/sql/sentinel.sql" >&9 2>&1
}

prove_cluster_identity() {
  (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" PASSVERO_PROOF_CLUSTER_IDENTITY=1 \
    "$NODE_BIN" --import tsx --test --test-name-pattern="live disposable cluster identity" \
    "$RUN_ROOT_REAL/harness/test/cluster-identity.test.ts") >&9 2>&1
  validate_cleanup_target >&9 2>&1 || die "STOP_CLUSTER_IDENTITY"
  FULL_IDENTITY_PROVEN=1
  PHASE=CLUSTER_IDENTITY_PROVEN
}

record_process_failure() {
  local id="$1" process_status="$2"
  (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" \
    "$NODE_BIN" --import tsx "$RUN_ROOT_REAL/harness/src/run-root.ts" \
    record-process-failure "$id" "$process_status") >>"$RUN_ROOT_REAL/log/$id.log" 2>&1
}

validate_hypothesis_result() {
  local id="$1" expected_status="$2"
  (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" \
    "$NODE_BIN" --import tsx "$RUN_ROOT_REAL/harness/src/run-root.ts" \
    validate-hypothesis-result "$id" "$expected_status") >>"$RUN_ROOT_REAL/log/$id.log" 2>&1
}

run_hypothesis() {
  local id="$1" gate="$2" test_file="$3" test_pattern="$4"
  local process_status structured_failure=0
  set +e
  if [[ -n "$test_pattern" ]]; then
    (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
      XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
      npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
      PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$gate=1" \
      "$NODE_BIN" --import tsx --test --test-concurrency=1 --test-name-pattern="$test_pattern" \
      "$RUN_ROOT_REAL/harness/test/$test_file") \
      >"$RUN_ROOT_REAL/log/$id.log" 2>&1
  else
    (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
      XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
      npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
      PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$gate=1" \
      "$NODE_BIN" --import tsx --test --test-concurrency=1 \
      "$RUN_ROOT_REAL/harness/test/$test_file") \
      >"$RUN_ROOT_REAL/log/$id.log" 2>&1
  fi
  process_status=$?
  if [[ "$process_status" -eq 0 ]]; then
    validate_hypothesis_result "$id" PASS || process_status=69
  elif validate_hypothesis_result "$id" FAIL; then
    structured_failure=1
  fi
  set -e
  if [[ "$process_status" -ne 0 && "$structured_failure" -eq 0 ]] \
    && ! record_process_failure "$id" "$process_status"; then
    printf '%s\n' "HYPOTHESIS=FAIL_RESULT_RECORD"
    return 1
  fi
  if [[ "$process_status" -eq 0 ]]; then
    printf '%s\n' "$id=PASS"
    return 0
  fi
  printf '%s\n' "$id=FAIL"
  return 1
}

aggregate_pending_evidence() {
  (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" \
    "$NODE_BIN" --import tsx "$RUN_ROOT_REAL/harness/src/run-root.ts" \
    aggregate-proof-evidence "$SCRIPT_DIR/evidence.pending.json" "$SCRIPT_DIR") >&9 2>&1
  PENDING_READY=1
}

run_hypotheses() {
  if ! run_hypothesis "H1_NATIVE_TRANSACTION" "PASSVERO_PROOF_H1" \
    "native-transaction.test.ts" "live H1 proves native and nested transaction behavior once"; then
    aggregate_pending_evidence
    return 1
  fi
  if ! run_hypothesis "H2_DIRECT_API_OUTER_TRANSACTION" "PASSVERO_PROOF_H2" \
    "direct-boundary.test.ts" "live H2 proves direct API commit and rollback matrices once"; then
    aggregate_pending_evidence
    return 1
  fi
  if ! run_hypothesis "H3_HANDLER_CONTEXT_REPLACEMENT" "PASSVERO_PROOF_H3" \
    "handler-boundary.test.ts" "live H3 demonstrates handler adapter replacement and remains rejected"; then
    aggregate_pending_evidence
    return 1
  fi
  if ! run_hypothesis "H4_CONTROLLED_ACTIVATION" "PASSVERO_PROOF_H4" \
    "controlled-activation.test.ts" "live H4 proves controlled activation and public signup rejection once"; then
    aggregate_pending_evidence
    return 1
  fi
  if ! run_hypothesis "H5_SESSION_COOKIE_AFTER_COMMIT" "PASSVERO_PROOF_H5" \
    "session-boundary.test.ts" "live H5 uses controlled activation and exercises sign-in, rotation, and password-change boundaries"; then
    aggregate_pending_evidence
    return 1
  fi
  if ! run_hypothesis "H6_RECOVERY_AND_REVOCATION" "PASSVERO_PROOF_H6" \
    "recovery-boundary.test.ts" "live H6 proves recovery with generated Prisma and Better Auth H2 boundaries"; then
    aggregate_pending_evidence
    return 1
  fi
  if ! run_hypothesis "H7_ROUTE_EXPOSURE" "PASSVERO_PROOF_H7" \
    "route-boundary.test.ts" ""; then
    aggregate_pending_evidence
    return 1
  fi
  aggregate_pending_evidence
}

validate_generated_sql() {
  local schema_file="$1"
  (cd "$RUN_ROOT_REAL/harness" && env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$NODE_BIN" --import tsx \
    "$RUN_ROOT_REAL/harness/src/run-root.ts" validate-generated-sql "$schema_file") >&9 2>&1 \
    || die "STOP_SCHEMA_ALLOWLIST"
}

append_reviewed_constraints() {
  local schema_file="$1"
  cat >>"$schema_file" <<'SQL'
CREATE UNIQUE INDEX "ux_auth_credential_token_one_active_per_provider_user_purpose" ON "AuthCredentialToken"("providerUserId", "purpose") WHERE "consumedAt" IS NULL AND "invalidatedAt" IS NULL;
CREATE UNIQUE INDEX "ux_account_activation_one_active_per_user" ON "AccountActivation"("userId") WHERE "consumedAt" IS NULL AND "invalidatedAt" IS NULL;
ALTER TABLE "AuthCredentialToken" ADD CONSTRAINT "ck_auth_credential_token_digest" CHECK ("tokenDigest" ~ '^[A-Za-z0-9_-]{43}$'), ADD CONSTRAINT "ck_auth_credential_token_target_email_digest" CHECK ("targetEmailDigest" ~ '^[A-Za-z0-9_-]{43}$'), ADD CONSTRAINT "ck_auth_credential_token_fixed_lifetime" CHECK ("expiresAt" = "createdAt" + CASE "purpose" WHEN 'EMAIL_VERIFICATION'::"AuthCredentialTokenPurpose" THEN INTERVAL '24 hours' WHEN 'PASSWORD_RESET'::"AuthCredentialTokenPurpose" THEN INTERVAL '30 minutes' END), ADD CONSTRAINT "ck_auth_credential_token_terminal_state" CHECK (NOT ("consumedAt" IS NOT NULL AND "invalidatedAt" IS NOT NULL)), ADD CONSTRAINT "ck_auth_credential_token_consumed_time" CHECK ("consumedAt" IS NULL OR ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt")), ADD CONSTRAINT "ck_auth_credential_token_invalidated_time" CHECK ("invalidatedAt" IS NULL OR "invalidatedAt" >= "createdAt");
ALTER TABLE "AccountActivation" ADD CONSTRAINT "ck_account_activation_digest" CHECK ("tokenDigest" ~ '^[A-Za-z0-9_-]{43}$'), ADD CONSTRAINT "ck_account_activation_intended_email_digest" CHECK ("intendedEmailDigest" ~ '^[A-Za-z0-9_-]{43}$'), ADD CONSTRAINT "ck_account_activation_expiry" CHECK ("expiresAt" > "createdAt"), ADD CONSTRAINT "ck_account_activation_terminal_state" CHECK (NOT ("consumedAt" IS NOT NULL AND "invalidatedAt" IS NOT NULL)), ADD CONSTRAINT "ck_account_activation_consumed_time" CHECK ("consumedAt" IS NULL OR ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt")), ADD CONSTRAINT "ck_account_activation_invalidated_time" CHECK ("invalidatedAt" IS NULL OR "invalidatedAt" >= "createdAt");
SQL
}

generate_apply_schema() {
  local application_role database
  application_role="$(protected_value "$RUN_ROOT_REAL/identity/application-role" 2>&9)" || die "STOP_IDENTITY_INVALID"
  database="$(protected_value "$RUN_ROOT_REAL/identity/database" 2>&9)" || die "STOP_IDENTITY_INVALID"
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$NPM_BIN" run generate --prefix "$RUN_ROOT_REAL/harness" \
    >&9 2>&1
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$NPM_BIN" run schema:sql --prefix "$RUN_ROOT_REAL/harness" \
    >"$RUN_ROOT_REAL/sql/schema.sql" 2>&9
  chmod 0600 "$RUN_ROOT_REAL/sql/schema.sql" >&9 2>&1
  validate_generated_sql "$RUN_ROOT_REAL/sql/schema.sql"
  append_reviewed_constraints "$RUN_ROOT_REAL/sql/schema.sql" >&9 2>&1
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" PGPASSFILE="$RUN_ROOT_REAL/identity/application-pgpass" \
    "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PROOF_PORT" -U "$application_role" -d "$database" -f "$RUN_ROOT_REAL/sql/schema.sql" \
    >&9 2>&1
  PHASE=SCHEMA_APPLIED
}

validate_partial_root() {
  [[ -n "$RUN_ROOT_REAL" && "$RUN_ROOT_REAL" =~ ^/private/tmp/passvero-stage13a-pg\.[A-Za-z0-9]+$ ]] || return 1
  [[ "$RUN_ROOT_REAL" != /private/tmp && "$RUN_ROOT_REAL" != / && "$RUN_ROOT_REAL" != "$REPOSITORY_ROOT" ]] || return 1
  [[ ! -L "$RUN_ROOT_REAL" && -d "$RUN_ROOT_REAL" ]] || return 1
  [[ "$(cd "$RUN_ROOT_REAL" && pwd -P)" == "$RUN_ROOT_REAL" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$RUN_ROOT_REAL")" == "$(id -u):700" ]] || return 1
}

prove_partial_postmaster() {
  validate_partial_root || return 1
  local data_dir="$RUN_ROOT_REAL/data" pid command recorded_pid
  [[ ! -L "$data_dir" && -d "$data_dir" ]] || return 1
  [[ "$(cd "$data_dir" && pwd -P)" == "$data_dir" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$data_dir")" == "$(id -u):700" ]] || return 1
  [[ ! -L "$data_dir/postmaster.pid" && -f "$data_dir/postmaster.pid" ]] || return 1
  pid="$(sed -n '1p' "$data_dir/postmaster.pid")" || return 1
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  command="$(ps -p "$pid" -o command= 2>&9)" || return 1
  [[ "$command" == *"$data_dir"* ]] || return 1
  if [[ -e "$RUN_ROOT_REAL/identity/postmaster-pid" || -L "$RUN_ROOT_REAL/identity/postmaster-pid" ]]; then
    recorded_pid="$(protected_value "$RUN_ROOT_REAL/identity/postmaster-pid")" || return 1
    [[ "$recorded_pid" == "$pid" ]] || return 1
  fi
  return 0
}

validate_local_cluster_identity() {
  validate_partial_root || return 1
  local run_id sentinel expected_hash pid command system_hash control_identifier control_hash
  run_id="$(protected_value "$RUN_ROOT_REAL/identity/run-id")" || return 1
  sentinel="$(protected_value "$RUN_ROOT_REAL/.passvero-stage13a-proof-root")" || return 1
  [[ "$sentinel" == "$SENTINEL_CONSTANT:$run_id" ]] || return 1
  expected_hash="$(protected_value "$RUN_ROOT_REAL/identity/run-id-hash")" || return 1
  [[ "$(printf '%s' "$run_id" | shasum -a 256 | awk '{print $1}')" == "$expected_hash" ]] || return 1
  pid="$(protected_value "$RUN_ROOT_REAL/identity/postmaster-pid")" || return 1
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  command="$(ps -p "$pid" -o command= 2>/dev/null)" || return 1
  [[ "$command" == *"$RUN_ROOT_REAL/data"* ]] || return 1
  system_hash="$(protected_value "$RUN_ROOT_REAL/identity/system-identifier-hash")" || return 1
  control_identifier="$(env -i PATH="$PG_BIN:/usr/bin:/bin" "$PG_BIN/pg_controldata" "$RUN_ROOT_REAL/data" | awk -F: '/Database system identifier/{gsub(/ /,"",$2);print $2}')"
  [[ "$control_identifier" =~ ^[0-9]+$ ]] || return 1
  control_hash="$(printf '%s' "$control_identifier" | shasum -a 256 | awk '{print $1}')"
  [[ "$control_hash" == "$system_hash" ]] || return 1
}

validate_cleanup_target() {
  validate_local_cluster_identity || return 1
  local expected_hash application_role database db_hash
  expected_hash="$(protected_value "$RUN_ROOT_REAL/identity/run-id-hash")" || return 1
  application_role="$(protected_value "$RUN_ROOT_REAL/identity/application-role")" || return 1
  database="$(protected_value "$RUN_ROOT_REAL/identity/database")" || return 1
  db_hash="$(env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" PGPASSFILE="$RUN_ROOT_REAL/identity/application-pgpass" "$PG_BIN/psql" -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PROOF_PORT" -U "$application_role" -d "$database" -c 'SELECT run_id_hash FROM passvero_stage13a_proof_sentinel')" || return 1
  [[ "$db_hash" == "$expected_hash" ]] || return 1
}

prepare_cleanup_evidence() {
  local pending="$SCRIPT_DIR/evidence.pending.json"
  [[ ! -e "$PREPARED_EVIDENCE" && ! -L "$PREPARED_EVIDENCE" ]] || return 1
  [[ ! -e "$ATTEMPT_STATE/.evidence-publication.json" && ! -L "$ATTEMPT_STATE/.evidence-publication.json" ]] || return 1
  [[ ! -e "$ATTEMPT_STATE/.evidence-publication.md" && ! -L "$ATTEMPT_STATE/.evidence-publication.md" ]] || return 1
  [[ ! -e "$SCRIPT_DIR/evidence.json" && ! -L "$SCRIPT_DIR/evidence.json" ]] || return 1
  [[ ! -e "$SCRIPT_DIR/evidence.md" && ! -L "$SCRIPT_DIR/evidence.md" ]] || return 1
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$NODE_BIN" --import tsx \
    "$RUN_ROOT_REAL/harness/src/run-root.ts" prepare-cleanup-evidence \
    "$pending" "$PREPARED_EVIDENCE" "$SCRIPT_DIR" >&9 2>&1
  PREPARED_READY=1
}

cleanup_mask() {
  local server_stopped="$1" listener_gone="$2" pid_gone="$3" root_gone="$4"
  [[ "$server_stopped" == true ]] && printf '1' || printf '0'
  [[ "$listener_gone" == true ]] && printf '1' || printf '0'
  [[ "$pid_gone" == true ]] && printf '1' || printf '0'
  [[ "$root_gone" == true ]] && printf '1' || printf '0'
}

validate_prepared_file() {
  local file="$1"
  [[ ! -L "$file" && -f "$file" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$file")" == "$(id -u):600" ]] || return 1
}

supervise_publication_child() {
  local key="$1" material="$2" pending_arg="$3"
  local publication_output="$ATTEMPT_STATE/publication-output.log" child_pid child_status=1
  local errexit_was_set=0 static_delay=0
  case "$-" in *e*) errexit_was_set=1 ;; esac
  [[ "$SIGNAL_STATUS" -eq 0 ]] || return 1
  [[ ! -L "$ATTEMPT_STATE" && -d "$ATTEMPT_STATE" ]] || return 1
  [[ "$(cd "$ATTEMPT_STATE" 2>&9 && pwd -P 2>&9)" == "$ATTEMPT_STATE" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$ATTEMPT_STATE" 2>&9)" == "$(id -u):700" ]] || return 1
  [[ ! -L "$publication_output" ]] || return 1
  install -m 0600 /dev/null "$publication_output" >&9 2>&1 || return 1
  [[ ! -L "$publication_output" && -f "$publication_output" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$publication_output" 2>&9)" == "$(id -u):600" ]] || return 1
  if [[ "${PASSVERO_PROOF_SOURCE_ONLY:-0}" == 1 \
    && "${PASSVERO_PROOF_STATIC_PUBLICATION_DELAY:-0}" == 1 ]]; then static_delay=1; fi
  (
    exec 2>&9
    exec 3>"$publication_output"
    exec 1>&3
    if [[ "$static_delay" -eq 1 ]]; then
      exec env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" \
        PASSVERO_PROOF_STATIC_PUBLICATION_DELAY=1 \
        "$NODE_BIN" "$HARNESS_SOURCE/src/publication.mjs" publish "$SCRIPT_DIR" "$material" \
        "$pending_arg" "$key"
    fi
    exec env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" \
      "$NODE_BIN" "$HARNESS_SOURCE/src/publication.mjs" publish "$SCRIPT_DIR" "$material" \
      "$pending_arg" "$key"
  ) &
  child_pid=$!
  PUBLICATION_CHILD_PID="$child_pid"
  PUBLICATION_CHILD_OWNER_SHELL_PID="$$"
  PUBLICATION_CHILD_TRUSTED=1
  PUBLICATION_CHILD_ACTIVE=1
  if [[ "$SIGNAL_STATUS" -ne 0 ]]; then terminate_publication_child || true; fi
  set +e
  wait "$child_pid"
  child_status=$?
  if [[ "$SIGNAL_STATUS" -ne 0 ]]; then
    local reaped_status
    terminate_publication_child || true
    wait "$child_pid" >/dev/null 2>&1
    reaped_status=$?
    if [[ "$reaped_status" -ne 127 ]]; then child_status="$reaped_status"; fi
  fi
  if [[ "$errexit_was_set" -eq 1 ]]; then set -e; else set +e; fi
  PUBLICATION_CHILD_ACTIVE=0
  PUBLICATION_CHILD_TRUSTED=0
  PUBLICATION_CHILD_PID=""
  PUBLICATION_CHILD_OWNER_SHELL_PID=""
  return "$child_status"
}

publish_candidate() {
  local key="$1" material="$2" pending_arg="$3" publication_status publication_output expected_output
  local errexit_was_set=0 publication_matches=1
  case "$-" in *e*) errexit_was_set=1 ;; esac
  [[ "$SIGNAL_STATUS" -eq 0 ]] || return 1
  set +e
  supervise_publication_child "$key" "$material" "$pending_arg"
  publication_status=$?
  publication_output="$(protected_value "$ATTEMPT_STATE/publication-output.log" 2>&9)" || publication_output=""
  if [[ "$key" == "pass-1111" ]]; then
    expected_output="PUBLICATION=PASS"
    if [[ "$publication_status" -ne 0 || "$publication_output" != "$expected_output" ]]; then publication_matches=0; fi
  else
    expected_output="PUBLICATION=FAIL"
    if [[ "$publication_status" -ne 1 || "$publication_output" != "$expected_output" ]]; then publication_matches=0; fi
  fi
  if [[ "$errexit_was_set" -eq 1 ]]; then set -e; else set +e; fi
  [[ "$publication_matches" -eq 1 ]]
}

publish_checked_failure() {
  local key="$1" material="$2" pending_arg="$3" safe_status="$4"
  if publish_candidate "$key" "$material" "$pending_arg"; then
    env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" \
      "$NODE_BIN" "$HARNESS_SOURCE/src/publication.mjs" finalize "$SCRIPT_DIR" FAIL >&9 2>&1 \
      || printf '%s\n' "CLEANUP=FAIL_FINAL_STATE"
    printf '%s\n' "$safe_status"
  else
    printf '%s\n' "CLEANUP=FAIL_PUBLICATION_RECOVERABLE"
  fi
  return 1
}

select_cleanup_candidate() {
  local proof_status="$1" mandatory_verdict="$2" suffix="$3"
  [[ "$proof_status" =~ ^[0-9]+$ && "$mandatory_verdict" =~ ^(PASS|FAIL)$ && "$suffix" =~ ^[01]{4}$ ]] || return 1
  if [[ "$proof_status" -eq 0 && "$mandatory_verdict" == PASS && "$suffix" == 1111 ]]; then
    printf '%s' "pass-1111"
  else
    printf '%s' "fail-$suffix"
  fi
}

current_cleanup_root() {
  if [[ -n "$RUN_ROOT_REAL" ]]; then printf '%s' "$RUN_ROOT_REAL"; else printf '%s' "$RUN_ROOT"; fi
}

can_inspect_postmaster_root() {
  [[ -n "$RUN_ROOT_REAL" && "$RUN_ROOT_REAL" == "$(current_cleanup_root)" ]]
}

validate_delete_target() {
  validate_partial_root || return 1
  local run_id sentinel expected_hash system_hash control_identifier control_hash
  run_id="$(protected_value "$RUN_ROOT_REAL/identity/run-id")" || return 1
  sentinel="$(protected_value "$RUN_ROOT_REAL/.passvero-stage13a-proof-root")" || return 1
  [[ "$sentinel" == "$SENTINEL_CONSTANT:$run_id" ]] || return 1
  expected_hash="$(protected_value "$RUN_ROOT_REAL/identity/run-id-hash")" || return 1
  [[ "$(printf '%s' "$run_id" | shasum -a 256 | awk '{print $1}')" == "$expected_hash" ]] || return 1
  [[ ! -L "$RUN_ROOT_REAL/data" && -d "$RUN_ROOT_REAL/data" ]] || return 1
  [[ "$(cd "$RUN_ROOT_REAL/data" && pwd -P)" == "$RUN_ROOT_REAL/data" ]] || return 1
  system_hash="$(protected_value "$RUN_ROOT_REAL/identity/system-identifier-hash")" || return 1
  control_identifier="$(env -i PATH="$PG_BIN:/usr/bin:/bin" "$PG_BIN/pg_controldata" "$RUN_ROOT_REAL/data" \
    | awk -F: '/Database system identifier/{gsub(/ /,"",$2);print $2}')" || return 1
  [[ "$control_identifier" =~ ^[0-9]+$ ]] || return 1
  control_hash="$(printf '%s' "$control_identifier" | shasum -a 256 | awk '{print $1}')"
  [[ "$control_hash" == "$system_hash" ]] || return 1
  "$NODE_BIN" -e 'const fs=require("fs");const [candidate,repository,uid]=process.argv.slice(1);const s=fs.lstatSync(candidate);if(s.isSymbolicLink()||!s.isDirectory()||s.uid!==Number(uid)||(s.mode&0o777)!==0o700||fs.realpathSync(candidate)!==candidate||candidate==="/"||candidate==="/private/tmp"||candidate===repository)process.exit(74)' \
    "$RUN_ROOT_REAL" "$REPOSITORY_ROOT" "$(id -u)"
}

cleanup() {
  local exit_status=$?
  trap - EXIT
  trap 'record_cleanup_signal 130' INT
  trap 'record_cleanup_signal 143' TERM
  [[ "$CLEANUP_ACTIVE" -eq 0 ]] || exit 1
  CLEANUP_ACTIVE=1
  set +e
  if [[ "$SIGNAL_STATUS" -ne 0 ]]; then exit_status="$SIGNAL_STATUS"; fi
  [[ "$PHASE" != UNCLAIMED ]] || exit "$exit_status"
  local serverStopped=true listenerGone=false pidGone=true rootGone=true
  if [[ "$CLEANUP_REQUIRED" -eq 1 || "$ROOT_ALLOCATION_UNCERTAIN" -eq 1 ]]; then rootGone=false; fi
  local pid="" full_cleanup=false mandatory_verdict=FAIL material="$FAILURE_MATERIAL" pending_arg="-"
  local cleanup_root
  cleanup_root="$(current_cleanup_root)"

  if [[ "$CLEANUP_REQUIRED" -eq 1 && -n "$cleanup_root" && ( -e "$cleanup_root" || -L "$cleanup_root" ) ]]; then
    rootGone=false
    cleanup_checkpoint IDENTITY
    if [[ -n "$RUN_ROOT_REAL" && "$FULL_IDENTITY_PROVEN" -eq 1 && "$PENDING_READY" -eq 1 ]] \
      && validate_cleanup_target >&9 2>&1; then
      if [[ "$PREPARED_READY" -eq 1 ]] || prepare_cleanup_evidence; then
        full_cleanup=true
        material="$PREPARED_EVIDENCE"
        pending_arg="$SCRIPT_DIR/evidence.pending.json"
        mandatory_verdict="$(protected_value "$PREPARED_EVIDENCE/mandatory-verdict" 2>&9)" || mandatory_verdict=FAIL
      fi
    fi

    cleanup_checkpoint STOP
    if can_inspect_postmaster_root && prove_partial_postmaster >&9 2>&1; then
      pid="$(sed -n '1p' "$RUN_ROOT_REAL/data/postmaster.pid")"
      serverStopped=false
      env -i PATH="$PG_BIN:/usr/bin:/bin" "$PG_BIN/pg_ctl" -D "$RUN_ROOT_REAL/data" stop -m fast \
        >&9 2>&1 && serverStopped=true
      if ! kill -0 "$pid" 2>/dev/null; then pidGone=true; else pidGone=false; fi
    elif can_inspect_postmaster_root \
      && [[ -e "$RUN_ROOT_REAL/data/postmaster.pid" && ! -L "$RUN_ROOT_REAL/data/postmaster.pid" ]]; then
      pid="$(sed -n '1p' "$RUN_ROOT_REAL/data/postmaster.pid" 2>&9)"
      if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
        serverStopped=false
        pidGone=false
      fi
    fi
  fi

  set +e
  env -i PATH="$PG_BIN:/usr/bin:/bin" "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PROOF_PORT" -q >/dev/null 2>&1
  local ready_status=$?
  if [[ "$ready_status" -eq 2 ]] && ! /usr/sbin/lsof -nP -iTCP:${PROOF_PORT} -sTCP:LISTEN >/dev/null 2>&1; then listenerGone=true; fi
  cleanup_checkpoint LISTENER
  if [[ -n "$pid" && "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then pidGone=false; fi

  if [[ "$full_cleanup" == true && "$serverStopped" == true && "$listenerGone" == true && "$pidGone" == true ]]; then
    cleanup_checkpoint DELETE
    if validate_delete_target >&9 2>&1; then
      rm -rf -- "$RUN_ROOT_REAL" >&9 2>&1
      if [[ ! -e "$RUN_ROOT_REAL" && ! -L "$RUN_ROOT_REAL" ]]; then rootGone=true; fi
    fi
  fi

  local suffix
  if [[ "$SIGNAL_STATUS" -ne 0 ]]; then exit_status="$SIGNAL_STATUS"; mandatory_verdict=FAIL; fi
  suffix="$(cleanup_mask "$serverStopped" "$listenerGone" "$pidGone" "$rootGone")"
  local candidate
  candidate="$(select_cleanup_candidate "$exit_status" "$mandatory_verdict" "$suffix")" || candidate="fail-$suffix"
  if [[ "$full_cleanup" != true ]]; then candidate="fail-$suffix"; fi
  cleanup_checkpoint PUBLICATION
  if [[ "$SIGNAL_STATUS" -ne 0 ]]; then candidate="fail-$suffix"; fi
  if [[ "$candidate" != "pass-1111" ]]; then
    local failure_status="CLEANUP=FAIL_RETAINED"
    [[ "$suffix" == 1111 ]] && failure_status="CLEANUP=FAIL_PROOF_WITH_COMPLETE_CLEANUP"
    publish_checked_failure "$candidate" "$material" "$pending_arg" "$failure_status"
    exit 1
  fi
  if ! publish_candidate "$candidate" "$material" "$pending_arg"; then
    printf '%s\n' "CLEANUP=FAIL_PUBLICATION_RECOVERABLE"
    exit 1
  fi
  printf '%s\n' "CLEANUP=PASS"
  exit 0
}

run_all() {
  preflight_attempt_artifacts
  preflight_port
  run_static_preflight
  preflight_attempt_artifacts
  preflight_port
  claim_attempt
  bootstrap_root
  start_cluster
  create_disposable_database
  prove_cluster_identity
  generate_apply_schema
  run_hypotheses
  prepare_cleanup_evidence
  PHASE=PENDING_READY
}

main() {
  require_mode "$@"
  if [[ "$1" == "--static" ]]; then
    run_static
  else
    exec 2>/dev/null
    run_all
  fi
}

if [[ "${PASSVERO_PROOF_SOURCE_ONLY:-0}" != 1 ]]; then
  main "$@"
fi
