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

die() {
  printf '%s\n' "$1" >&2
  exit 1
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
    "$NODE_BIN" --test "$REPOSITORY_ROOT/tests/auth-foundation-transaction-proof-source.test.mjs"
}

run_static() {
  local static_root
  run_source_gate
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
    src/run-root.ts test/cluster-identity.test.ts); then
    static_cleanup "$static_root"
    return 1
  fi
  static_cleanup "$static_root"
  printf '%s\n' "STATIC_PROOF=PASS"
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

bootstrap_root() {
  RUN_ROOT="$(mktemp -d /private/tmp/passvero-stage13a-pg.XXXXXX)"
  chmod 0700 "$RUN_ROOT"
  RUN_ROOT_REAL="$(cd "$RUN_ROOT" && pwd -P)"
  [[ "$RUN_ROOT_REAL" == "$RUN_ROOT" ]] || die "STOP_RUN_ROOT_INVALID"
  CLEANUP_REQUIRED=1
  trap cleanup EXIT
  cp -R "$HARNESS_SOURCE" "$RUN_ROOT_REAL/harness"
  chmod 0700 "$RUN_ROOT_REAL/harness"
  mkdir -m 0700 "$RUN_ROOT_REAL/harness/cache" "$RUN_ROOT_REAL/harness/tmp"
  install -m 0600 /dev/null "$RUN_ROOT_REAL/harness/npmrc"
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    "$NPM_BIN" ci --ignore-scripts --no-audit --no-fund --loglevel=error --prefix "$RUN_ROOT_REAL/harness"
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" \
    "$NODE_BIN" --import tsx \
    "$RUN_ROOT_REAL/harness/src/run-root.ts" bootstrap "$RUN_ROOT_REAL"
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
  superuser_role="$(protected_value "$RUN_ROOT_REAL/identity/superuser-role")" || die "STOP_IDENTITY_INVALID"
  [[ "$superuser_role" =~ ^pvproof_admin_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    "$PG_BIN/initdb" -D "$RUN_ROOT_REAL/data" --encoding=UTF8 --locale=C \
    --username="$superuser_role" --auth-local=scram-sha-256 --auth-host=scram-sha-256 \
    --pwfile="$RUN_ROOT_REAL/identity/superuser-password" >/dev/null
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    "$PG_BIN/pg_ctl" -D "$RUN_ROOT_REAL/data" -l "$RUN_ROOT_REAL/log/postgres.log" \
    -o "-h 127.0.0.1 -p 55432 -k $RUN_ROOT_REAL/socket -c listen_addresses=127.0.0.1 -c unix_socket_permissions=0700" start >/dev/null
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" "$NODE_BIN" -e 'const fs=require("fs");const [source,target]=process.argv.slice(1);const pid=fs.readFileSync(source,"utf8").split("\n",1)[0];if(!/^\d+$/.test(pid))process.exit(72);fs.writeFileSync(target,pid,{mode:0o600,flag:"wx"})' \
    "$RUN_ROOT_REAL/data/postmaster.pid" "$RUN_ROOT_REAL/identity/postmaster-pid"
}

create_disposable_database() {
  local superuser_role application_role database
  superuser_role="$(protected_value "$RUN_ROOT_REAL/identity/superuser-role")" || die "STOP_IDENTITY_INVALID"
  application_role="$(protected_value "$RUN_ROOT_REAL/identity/application-role")" || die "STOP_IDENTITY_INVALID"
  database="$(protected_value "$RUN_ROOT_REAL/identity/database")" || die "STOP_IDENTITY_INVALID"
  [[ "$superuser_role" =~ ^pvproof_admin_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  [[ "$application_role" =~ ^pvproof_app_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  [[ "$database" =~ ^pvproof_test_[a-f0-9]{12}$ ]] || die "STOP_IDENTITY_INVALID"
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    PGPASSFILE="$RUN_ROOT_REAL/identity/superuser-pgpass" \
    "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PROOF_PORT" \
    -U "$superuser_role" -d postgres -v app_role="$application_role" -v database="$database" \
    -f "$RUN_ROOT_REAL/sql/cluster-bootstrap.sql" -f "$RUN_ROOT_REAL/sql/role-password.sql" >/dev/null
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    PGPASSFILE="$RUN_ROOT_REAL/identity/application-pgpass" \
    "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PROOF_PORT" \
    -U "$application_role" -d "$database" -f "$RUN_ROOT_REAL/sql/sentinel.sql" >/dev/null
}

prove_cluster_identity() {
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" PASSVERO_PROOF_CLUSTER_IDENTITY=1 \
    "$NODE_BIN" --import tsx --test --test-name-pattern="live disposable cluster identity" \
    "$RUN_ROOT_REAL/harness/test/cluster-identity.test.ts"
}

validate_generated_sql() {
  local schema_file="$1"
  "$NODE_BIN" -e 'const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8");const ok=new Set(["User","AuthIdentity","AccountActivation","AuthCredentialToken","AuthAbuseBucket","ProofMarker","AuthProviderUser","AuthProviderSession","AuthProviderAccount","AuthProviderVerification"]);for(const m of s.matchAll(/CREATE TABLE \"([^\"]+)\"/g)){if(!ok.has(m[1]))process.exit(73)}' "$schema_file" || die "STOP_SCHEMA_ALLOWLIST"
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
  application_role="$(protected_value "$RUN_ROOT_REAL/identity/application-role")" || die "STOP_IDENTITY_INVALID"
  database="$(protected_value "$RUN_ROOT_REAL/identity/database")" || die "STOP_IDENTITY_INVALID"
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$NPM_BIN" ci --ignore-scripts --no-audit --no-fund --loglevel=error --prefix "$RUN_ROOT_REAL/harness"
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$NPM_BIN" run generate --prefix "$RUN_ROOT_REAL/harness" >/dev/null
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" \
    XDG_CACHE_HOME="$RUN_ROOT_REAL/harness/cache" npm_config_cache="$RUN_ROOT_REAL/harness/cache" \
    npm_config_userconfig="$RUN_ROOT_REAL/harness/npmrc" NODE_OPTIONS="--no-warnings" \
    PASSVERO_PROOF_RUN_ROOT="$RUN_ROOT_REAL" "$NPM_BIN" run schema:sql --prefix "$RUN_ROOT_REAL/harness" >"$RUN_ROOT_REAL/sql/schema.sql"
  chmod 0600 "$RUN_ROOT_REAL/sql/schema.sql"
  validate_generated_sql "$RUN_ROOT_REAL/sql/schema.sql"
  append_reviewed_constraints "$RUN_ROOT_REAL/sql/schema.sql"
  env -i PATH="$PG_BIN:/usr/bin:/bin" TMPDIR="$RUN_ROOT_REAL/harness/tmp" PGPASSFILE="$RUN_ROOT_REAL/identity/application-pgpass" \
    "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PROOF_PORT" -U "$application_role" -d "$database" -f "$RUN_ROOT_REAL/sql/schema.sql" >/dev/null
}

validate_local_cluster_identity() {
  [[ -n "$RUN_ROOT_REAL" && "$RUN_ROOT_REAL" =~ ^/private/tmp/passvero-stage13a-pg\.[A-Za-z0-9]+$ ]] || return 1
  [[ "$RUN_ROOT_REAL" != /private/tmp && "$RUN_ROOT_REAL" != / && "$RUN_ROOT_REAL" != "$REPOSITORY_ROOT" ]] || return 1
  [[ ! -L "$RUN_ROOT_REAL" && -d "$RUN_ROOT_REAL" ]] || return 1
  [[ "$(cd "$RUN_ROOT_REAL" && pwd -P)" == "$RUN_ROOT_REAL" ]] || return 1
  [[ "$(stat -f '%u:%Lp' "$RUN_ROOT_REAL")" == "$(id -u):700" ]] || return 1
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

stop_proven_cluster_on_retention() {
  validate_local_cluster_identity || return 0
  env -i PATH="$PG_BIN:/usr/bin:/bin" "$PG_BIN/pg_ctl" -D "$RUN_ROOT_REAL/data" stop -m fast >/dev/null 2>&1 || true
}

finalize_cleanup_evidence() {
  local pending="$SCRIPT_DIR/evidence.pending.json"
  [[ ! -L "$pending" && -f "$pending" ]] || return 1
  "$NODE_BIN" -e 'const fs=require("fs");const p=process.argv[1];const o=JSON.parse(fs.readFileSync(p,"utf8"));if(Object.hasOwn(o,"cleanup"))process.exit(71)' "$pending" || return 1
  "$NODE_BIN" -e 'const fs=require("fs");const [p,j,m]=process.argv.slice(1);const o=JSON.parse(fs.readFileSync(p,"utf8"));o.cleanup={serverStopped:true,listenerGone:true,pidGone:true,rootGone:true};fs.writeFileSync(j,JSON.stringify(o,null,2)+"\n",{mode:0o600});fs.writeFileSync(m,"# Better Auth transaction proof evidence\n\nCLEANUP=PASS\n",{mode:0o600})' "$pending" "$SCRIPT_DIR/evidence.json" "$SCRIPT_DIR/evidence.md"
  rm -f -- "$pending"
}

finalize_failure_evidence() {
  local server_stopped="$1" listener_gone="$2" pid_gone="$3" root_gone="$4"
  local pending="$SCRIPT_DIR/evidence.pending.json"
  "$NODE_BIN" -e 'const fs=require("fs");const [p,j,m,a,b,c,d]=process.argv.slice(1);let o={};try{o=JSON.parse(fs.readFileSync(p,"utf8"))}catch{};delete o.cleanup;o.status="FAIL";o.cleanup={serverStopped:a==="true",listenerGone:b==="true",pidGone:c==="true",rootGone:d==="true"};fs.writeFileSync(j,JSON.stringify(o,null,2)+"\n",{mode:0o600});fs.writeFileSync(m,"# Better Auth transaction proof evidence\n\nSTATUS=FAIL\n",{mode:0o600})' \
    "$pending" "$SCRIPT_DIR/evidence.json" "$SCRIPT_DIR/evidence.md" "$server_stopped" "$listener_gone" "$pid_gone" "$root_gone" || true
}

cleanup() {
  local exit_status=$?
  trap - EXIT
  set +e
  [[ "$CLEANUP_REQUIRED" -eq 1 ]] || exit "$exit_status"
  if ! validate_cleanup_target; then
    stop_proven_cluster_on_retention
    finalize_failure_evidence false false false false
    printf '%s\n' "CLEANUP=FAIL_RETAINED:$(basename "$RUN_ROOT_REAL")" >&2
    exit 1
  fi
  local pending="$SCRIPT_DIR/evidence.pending.json"
  if [[ ! -f "$pending" ]] || ! "$NODE_BIN" -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(Object.hasOwn(o,"cleanup"))process.exit(1)' "$pending"; then
    stop_proven_cluster_on_retention
    finalize_failure_evidence false false false false
    printf '%s\n' "CLEANUP=FAIL_RETAINED:$(basename "$RUN_ROOT_REAL")" >&2
    exit 1
  fi
  local pid serverStopped=false listenerGone=false pidGone=false rootGone=false
  pid="$(protected_value "$RUN_ROOT_REAL/identity/postmaster-pid")"
  env -i PATH="$PG_BIN:/usr/bin:/bin" "$PG_BIN/pg_ctl" -D "$RUN_ROOT_REAL/data" stop -m fast >/dev/null 2>&1 && serverStopped=true
  set +e
  env -i PATH="$PG_BIN:/usr/bin:/bin" "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PROOF_PORT" -q >/dev/null 2>&1
  local ready_status=$?
  set -e
  if [[ "$ready_status" -eq 2 ]] && ! /usr/sbin/lsof -nP -iTCP:${PROOF_PORT} -sTCP:LISTEN >/dev/null 2>&1; then listenerGone=true; fi
  if ! kill -0 "$pid" 2>/dev/null; then pidGone=true; fi
  if [[ "$serverStopped" == true && "$listenerGone" == true && "$pidGone" == true ]]; then
    rm -rf -- "$RUN_ROOT_REAL"
    if [[ ! -e "$RUN_ROOT_REAL" ]]; then rootGone=true; fi
  fi
  if [[ "$serverStopped" == true && "$listenerGone" == true && "$pidGone" == true && "$rootGone" == true ]]; then
    if ! finalize_cleanup_evidence; then
      finalize_failure_evidence true true true true
      exit 1
    fi
    printf '%s\n' "CLEANUP=PASS"
    exit "$exit_status"
  fi
  finalize_failure_evidence "$serverStopped" "$listenerGone" "$pidGone" "$rootGone"
  printf '%s\n' "CLEANUP=FAIL_RETAINED:$(basename "$RUN_ROOT_REAL")" >&2
  exit 1
}

run_all() {
  run_source_gate
  preflight_port
  run_static
  bootstrap_root
  start_cluster
  create_disposable_database
  prove_cluster_identity
  generate_apply_schema
  die "STOP_HYPOTHESES_NOT_IMPLEMENTED"
}

main() {
  require_mode "$@"
  if [[ "$1" == "--static" ]]; then
    run_static
  else
    run_all
  fi
}

main "$@"
