#!/bin/bash
set -euo pipefail
umask 077

[[ $# -eq 1 ]] || exit 64
runner="$1"
[[ ! -L "$runner" && -f "$runner" ]] || exit 65

export PASSVERO_PROOF_SOURCE_ONLY=1
source "$runner"

fail() {
  local frame
  frame="$(caller 0)"
  printf '%s\n' "STATIC_SHELL_SIMULATION=FAIL_${frame%% *}"
  exit 1
}

test_root=""
cleanup_simulation_fixtures() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n "${RUN_ROOT:-}" && ( -e "$RUN_ROOT" || -L "$RUN_ROOT" ) ]] \
    && [[ "$RUN_ROOT" =~ ^/private/tmp/passvero-stage13a-pg\.[A-Za-z0-9]+$ ]] \
    && [[ ! -L "$RUN_ROOT" && -d "$RUN_ROOT" ]] \
    && [[ "$(realpath "$RUN_ROOT" 2>/dev/null)" == "$RUN_ROOT" ]] \
    && [[ "$(stat -f '%u:%Lp' "$RUN_ROOT" 2>/dev/null)" == "$(id -u):700" ]] \
    && [[ -z "$(find "$RUN_ROOT" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    rmdir "$RUN_ROOT" 2>/dev/null
  fi
  if [[ -n "$test_root" && ( -e "$test_root" || -L "$test_root" ) ]] \
    && [[ "$test_root" =~ ^/private/tmp/passvero-stage13a-shelltest\.[A-Za-z0-9]+$ ]] \
    && [[ ! -L "$test_root" && -d "$test_root" ]] \
    && [[ "$(realpath "$test_root" 2>/dev/null)" == "$test_root" ]] \
    && [[ "$(stat -f '%u:%Lp' "$test_root" 2>/dev/null)" == "$(id -u):700" ]]; then
    rm -rf -- "$test_root" 2>/dev/null
  fi
  exit "$status"
}
trap cleanup_simulation_fixtures EXIT

test_root="$(mktemp -d /private/tmp/passvero-stage13a-shelltest.XXXXXX)"
chmod 0700 "$test_root"
state_root="$test_root/state"
mkdir -m 0700 "$state_root" "$state_root/logs"
ATTEMPT_STATE="$state_root"
ATTEMPT_LOG="$state_root/logs/orchestration.log"
install -m 0600 /dev/null "$ATTEMPT_LOG"
open_attempt_log || fail

declare -F prearm_root_allocation >/dev/null || fail
declare -F allocate_run_root >/dev/null || fail

PASSVERO_PROOF_STATIC_INJECT=SIGNAL_BEFORE_MKTEMP
CLEANUP_ACTIVE=1
SIGNAL_STATUS=0
trap 'request_signal_failure 143' TERM
set +e
bootstrap_root
bootstrap_status=$?
set -e
trap - TERM
CLEANUP_ACTIVE=0
unset PASSVERO_PROOF_STATIC_INJECT
[[ "$bootstrap_status" -eq 143 ]] || fail
[[ "$CLEANUP_REQUIRED" -eq 1 && "$PHASE" == ROOT_ALLOCATION_PENDING ]] || fail
[[ -z "$RUN_ROOT" && -z "$RUN_ROOT_REAL" ]] || fail
[[ "$(cleanup_mask true true true false)" == 1110 ]] || fail
[[ "$(select_cleanup_candidate "$bootstrap_status" FAIL 1110)" == fail-1110 ]] || fail
[[ ! -L "$ATTEMPT_STATE/root-allocation.path" && -f "$ATTEMPT_STATE/root-allocation.path" ]] || fail
[[ "$(stat -f '%u:%Lp' "$ATTEMPT_STATE/root-allocation.path")" == "$(id -u):600" ]] || fail
[[ ! -s "$ATTEMPT_STATE/root-allocation.path" ]] || fail
unlink "$ATTEMPT_STATE/root-allocation.path"

PASSVERO_PROOF_STATIC_INJECT=AFTER_MKTEMP_BEFORE_ASSIGNMENT
set +e
bootstrap_root
bootstrap_status=$?
set -e
unset PASSVERO_PROOF_STATIC_INJECT
[[ "$bootstrap_status" -eq 97 ]] || fail
[[ "$CLEANUP_REQUIRED" -eq 1 && "$PHASE" == ROOT_ALLOCATION_PENDING ]] || fail
[[ -z "$RUN_ROOT" && -z "$RUN_ROOT_REAL" ]] || fail
[[ "$(cleanup_mask true true true false)" == 1110 ]] || fail
[[ "$(select_cleanup_candidate "$bootstrap_status" FAIL 1110)" == fail-1110 ]] || fail
allocation_state="$ATTEMPT_STATE/root-allocation.path"
retained_allocation_root="$(protected_value "$allocation_state")" || fail
[[ "$retained_allocation_root" =~ ^/private/tmp/passvero-stage13a-pg\.[A-Za-z0-9]+$ ]] || fail
[[ ! -L "$retained_allocation_root" && -d "$retained_allocation_root" ]] || fail
[[ "$(realpath "$retained_allocation_root")" == "$retained_allocation_root" ]] || fail
[[ "$(stat -f '%u:%Lp' "$retained_allocation_root")" == "$(id -u):700" ]] || fail
[[ -z "$(find "$retained_allocation_root" -mindepth 1 -maxdepth 1 -print -quit)" ]] || fail
rmdir "$retained_allocation_root"
unlink "$allocation_state"

PASSVERO_PROOF_STATIC_INJECT=AFTER_MKTEMP
set +e
bootstrap_root
bootstrap_status=$?
set -e
unset PASSVERO_PROOF_STATIC_INJECT
[[ "$bootstrap_status" -eq 97 ]] || fail
[[ "$CLEANUP_REQUIRED" -eq 1 && "$PHASE" == ROOT_ALLOCATED ]] || fail
[[ -z "$RUN_ROOT_REAL" && "$(current_cleanup_root)" == "$RUN_ROOT" ]] || fail
[[ "$RUN_ROOT" =~ ^/private/tmp/passvero-stage13a-pg\.[A-Za-z0-9]+$ ]] || fail
[[ ! -L "$RUN_ROOT" && -d "$RUN_ROOT" ]] || fail
[[ "$(stat -f '%u:%Lp' "$RUN_ROOT")" == "$(id -u):700" ]] || fail
[[ "$(select_cleanup_candidate "$bootstrap_status" FAIL 1110)" == fail-1110 ]] || fail
declare -F can_inspect_postmaster_root >/dev/null || fail
if can_inspect_postmaster_root; then fail; fi
rmdir "$RUN_ROOT"
RUN_ROOT=""

for signal_status in 130 143; do
  SIGNAL_STATUS=0
  CLEANUP_ACTIVE=1
  record_cleanup_signal "$signal_status"
  record_cleanup_signal 143
  [[ "$SIGNAL_STATUS" -eq "$signal_status" ]] || fail
  [[ "$(select_cleanup_candidate "$SIGNAL_STATUS" PASS 1111)" == fail-1111 ]] || fail
done
CLEANUP_ACTIVE=0
SIGNAL_STATUS=0

for cleanup_phase in IDENTITY STOP LISTENER DELETE PUBLICATION; do
  PASSVERO_PROOF_STATIC_INJECT="SIGNAL_$cleanup_phase"
  SIGNAL_STATUS=0
  cleanup_checkpoint "$cleanup_phase"
  [[ "$SIGNAL_STATUS" -eq 130 ]] || fail
  [[ "$(select_cleanup_candidate "$SIGNAL_STATUS" PASS 1111)" == fail-1111 ]] || fail
done
unset PASSVERO_PROOF_STATIC_INJECT
SIGNAL_STATUS=0

fake_exact="$test_root/fake-exact"
fake_empty="$test_root/fake-empty"
fake_wrong="$test_root/fake-wrong"
fake_fail="$test_root/fake-fail"
real_node_bin="$NODE_BIN"
printf '%s\n' '#!/bin/bash' 'printf "%s\n" "PUBLICATION=PASS"' 'exit 0' >"$fake_exact"
printf '%s\n' '#!/bin/bash' 'exit 0' >"$fake_empty"
printf '%s\n' '#!/bin/bash' 'printf "%s\n" "PUBLICATION=WRONG"' 'exit 0' >"$fake_wrong"
printf '%s\n' '#!/bin/bash' 'printf "%s\n" "PUBLICATION=FAIL"' 'exit 1' >"$fake_fail"
chmod 0700 "$fake_exact" "$fake_empty" "$fake_wrong" "$fake_fail"
NODE_BIN="$fake_exact"
publish_candidate pass-1111 unused - || fail
NODE_BIN="$fake_empty"
if publish_candidate pass-1111 unused -; then fail; fi
NODE_BIN="$fake_wrong"
if publish_candidate pass-1111 unused -; then fail; fi
NODE_BIN="$fake_fail"
publish_candidate fail-1111 unused - || fail

declare -F supervise_publication_child >/dev/null || fail

original_script_dir="$SCRIPT_DIR"
original_attempt_state="$ATTEMPT_STATE"
original_attempt_log="$ATTEMPT_LOG"
for signal_name in TERM INT; do
  signal_case_root="$test_root/signal-$signal_name"
  mkdir -m 0700 "$signal_case_root"
  install -m 0600 /dev/null "$signal_case_root/setup.log"
  env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" \
    "$real_node_bin" "$HARNESS_SOURCE/src/publication.mjs" claim "$signal_case_root" \
    >"$signal_case_root/setup.log" 2>&1 || fail
  ATTEMPT_STATE="$signal_case_root/.proof-attempt-state"
  ATTEMPT_LOG="$ATTEMPT_STATE/logs/orchestration.log"
  prepared_root="$ATTEMPT_STATE/prepared"
  mkdir -m 0700 "$prepared_root"
  for candidate in fail-1111 pass-1111; do
    install -m 0600 /dev/null "$prepared_root/$candidate.json"
    install -m 0600 /dev/null "$prepared_root/$candidate.md"
  done
  printf '%s\n' '{"status":"FAIL"}' >"$prepared_root/fail-1111.json"
  printf '%s\n' 'NON-AUTHORITATIVE: evidence.json is authoritative.' >"$prepared_root/fail-1111.md"
  printf '%s\n' '{"status":"PASS"}' >"$prepared_root/pass-1111.json"
  printf '%s\n' 'NON-AUTHORITATIVE: evidence.json is authoritative.' >"$prepared_root/pass-1111.md"
  pending_path="$signal_case_root/evidence.pending.json"
  install -m 0600 /dev/null "$pending_path"
  printf '%s\n' '{"status":"PENDING"}' >"$pending_path"
  SCRIPT_DIR="$signal_case_root"
  NODE_BIN="$real_node_bin"
  PASSVERO_PROOF_STATIC_PUBLICATION_DELAY=1
  SIGNAL_STATUS=0
  CLEANUP_ACTIVE=1
  trap 'request_signal_failure 130' INT
  trap 'request_signal_failure 143' TERM
  parent_pid="$$"
  (
    signal_wait_count=0
    while [[ ! -e "$signal_case_root/pre-json-window" && "$signal_wait_count" -lt 400 ]]; do
      sleep 0.01
      signal_wait_count=$((signal_wait_count + 1))
    done
    [[ -e "$signal_case_root/pre-json-window" ]] || exit 91
    kill -s "$signal_name" "$parent_pid"
  ) &
  signal_sender_pid=$!
  publication_status=0
  publish_candidate pass-1111 "$prepared_root" "$pending_path" \
    >"$signal_case_root/terminal-output" 2>&1 \
    || publication_status=$?
  set +e
  wait "$signal_sender_pid"
  signal_sender_status=$?
  set -e
  trap - INT TERM
  CLEANUP_ACTIVE=0
  [[ "$signal_sender_status" -eq 0 && "$publication_status" -ne 0 ]] || fail
  if [[ "$signal_name" == TERM ]]; then expected_signal_status=143; else expected_signal_status=130; fi
  [[ "$SIGNAL_STATUS" -eq "$expected_signal_status" ]] || fail
  [[ ! -L "$signal_case_root/evidence.json" && -f "$signal_case_root/evidence.json" ]] || fail
  grep -Eq '^\{"status":"FAIL"\}$' "$signal_case_root/evidence.json" || fail
  if grep -Eq '"status":"PASS"' "$signal_case_root/evidence.json"; then fail; fi
  [[ ! -L "$ATTEMPT_STATE/attempt-claimed.json" && -f "$ATTEMPT_STATE/attempt-claimed.json" ]] || fail
  [[ "${PUBLICATION_CHILD_ACTIVE:-0}" -eq 0 && -z "${PUBLICATION_CHILD_PID:-}" ]] || fail
  if grep -Eq 'PUBLICATION=PASS|CLEANUP=PASS' "$signal_case_root/terminal-output"; then fail; fi
done
unset PASSVERO_PROOF_STATIC_PUBLICATION_DELAY
SCRIPT_DIR="$original_script_dir"
ATTEMPT_STATE="$original_attempt_state"
ATTEMPT_LOG="$original_attempt_log"
SIGNAL_STATUS=0

capture_log_open_failure() {
  local output status
  set +e
  output="$(open_attempt_log 2>&1)"
  status=$?
  set -e
  [[ "$status" -ne 0 ]] || return 1
  [[ -z "$output" ]] || return 1
}

missing_state="$test_root/missing-state"
mkdir -m 0700 "$missing_state" "$missing_state/logs"
ATTEMPT_STATE="$missing_state"
ATTEMPT_LOG="$missing_state/logs/orchestration.log"
capture_log_open_failure || fail

unwritable_state="$test_root/unwritable-state"
mkdir -m 0700 "$unwritable_state" "$unwritable_state/logs"
ATTEMPT_STATE="$unwritable_state"
ATTEMPT_LOG="$unwritable_state/logs/orchestration.log"
install -m 0400 /dev/null "$ATTEMPT_LOG"
capture_log_open_failure || fail

symlink_state="$test_root/symlink-state"
mkdir -m 0700 "$symlink_state" "$symlink_state/logs"
install -m 0600 /dev/null "$symlink_state/target.log"
ln -s "$symlink_state/target.log" "$symlink_state/logs/orchestration.log"
ATTEMPT_STATE="$symlink_state"
ATTEMPT_LOG="$symlink_state/logs/orchestration.log"
capture_log_open_failure || fail

unlink "$symlink_state/logs/orchestration.log"
unlink "$symlink_state/target.log"
rmdir "$symlink_state/logs" "$symlink_state"
chmod 0600 "$unwritable_state/logs/orchestration.log"
unlink "$unwritable_state/logs/orchestration.log"
rmdir "$unwritable_state/logs" "$unwritable_state"
rmdir "$missing_state/logs" "$missing_state"
for signal_name in TERM INT; do
  signal_case_root="$test_root/signal-$signal_name"
  [[ "$signal_case_root" == "$test_root/signal-$signal_name" ]] || fail
  [[ ! -L "$signal_case_root" && -d "$signal_case_root" ]] || fail
  [[ "$(realpath "$signal_case_root")" == "$signal_case_root" ]] || fail
  [[ "$(stat -f '%u:%Lp' "$signal_case_root")" == "$(id -u):700" ]] || fail
  rm -rf -- "$signal_case_root"
  [[ ! -e "$signal_case_root" && ! -L "$signal_case_root" ]] || fail
done
for temporary_file in "$fake_exact" "$fake_empty" "$fake_wrong" "$fake_fail" \
  "$state_root/publication-output.log" "$state_root/logs/orchestration.log"; do
  unlink "$temporary_file"
done
rmdir "$state_root/logs" "$state_root" "$test_root"

printf '%s\n' "STATIC_SHELL_SIMULATION=PASS"
