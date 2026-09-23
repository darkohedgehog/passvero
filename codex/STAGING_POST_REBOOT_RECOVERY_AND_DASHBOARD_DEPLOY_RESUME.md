# Staging post-reboot recovery — 2026-09-23

## Scope and evidence

User-authorized staging recovery after a manual VPS reboot. Operator executed all sudo commands; no production changes, database migrations, business-data mutations, commit or push. The reviewed dashboard source and build are preserved; unchanged local checks were not repeated.

## Runtime recovery: PASS (operator evidence)

The saved PM2 dump contained exactly one `passvero-acceptance` application under `passvero-staging`, using `/usr/bin/node` and `/var/www/passvero-acceptance/node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001`. No staging processes or staging startup unit existed after boot. The saved dump and previous release survived.

The operator restored the saved runtime and enabled the dedicated `pm2-passvero-staging.service`. It resurrects the existing staging PM2 home; application configuration and saved dump remain unchanged.

- Previous/current recovered build: `U97P6q7YqVzFHSNqoWAT9`.
- Login HTTPS: `200`; TLS verification: `0`.
- Startup service: `ENABLED_ACTIVE`.
- Actual reboot acceptance: `NOT_PROVEN`; no new reboot performed.
- Saved dump SHA-256: `df75ef67958a1b0e15b18c8ab2b82d9c3b4c94d72ce90120a99ae52e28aa499f`.
- Recovery script SHA-256: `66fdc78838363792f39b50473c1be117326245d50c968a3e90680912f6b07d3c`.
- Backup and rollback: `/var/lib/passvero-post-reboot-20260923/`; `rollback.py` disables/removes only the added staging startup unit and stops its runtime, returning to the pre-recovery stopped state. It preserves the saved dump.

## Signature health: BLOCKED, fail-closed preserved

Operator boot diagnostics showed `UNTRUSTED / PRIVATE_INPUT_REQUIRED / COLLECT`. `/etc/clamav/freshclam.conf` has UID 108, whereas producer configuration input validation requires root ownership. Its content hash still matches the configured hash. The cause of that ownership transition is not established.

The updater evidence separately contains two initialization separators. The existing parser rejects a second initialization with `EVIDENCE_CONTINUITY_REQUIRED`; fixing ownership alone cannot restore trust. Freshclam and clamd are active. The health snapshot is absent, the sequence is retained, and no lock was present at inspection. No ownership, log, timestamp, database, lock, freshness, policy, confinement or resource-limit changes were made.

The existing repository contract requires a newly verified base after continuity loss. The archived historical bootstrap source is a one-time fresh-establishment procedure guarded by absent attempt records, an empty database directory and an absent evidence log. Its current on-host source hash was not reverified. No reviewed procedure was established that covers re-establishment over the retained populated state. Reusing that bootstrap would require a separately reviewed recovery adaptation; deleting its guards or retained history is not an acceptable workaround. No new trust mechanism was introduced.

This missing applicable trust-reestablishment procedure is the remaining blocker. Successful producer publication, staging-reader acceptance and the next regular scheduled publication are **not confirmed**. Earlier unrelated NOT_PROVEN statuses remain unchanged.

The qpdf socket is active/listening; its service is inactive under the existing socket-activation model. This is not itself a failure; neither was restarted.

## Dashboard deploy: NOT_EXECUTED

The deploy stopped in VERIFY before replacing application files; no dashboard deployment state directory existed at inspection. This is a runtime prerequisite blocker, not a dashboard-source failure.

- Source base: `889f78d1d01f13107dbdc4aa1edf567a1bab5a5d`.
- All 21 reviewed files matched their existing source-review hashes before recovery.
- Prepared build: `qwLCXFTd9EEGdvqaB9SZS` (not deployed).
- Durable package: `/home/darko/passvero-dashboard-ui-889f78d`; temporary copy also survived the latest check.
- Package checksum-manifest SHA-256: `2da3590fe0f59fee14958bf5378b3b293657a2dbc245a3dcf648be886164bb70`; all package entries verified.
- Planned dashboard rollback: `/var/lib/passvero-dashboard-ui-889f78d/application/rollback.py`; not installed because deploy has not reached PREPARE.
- New dashboard live UI acceptance: pending.

The original deploy wrapper also assumes the qpdf service is continuously active. Before resuming, its operational guard must be reviewed against the documented socket-activation model; do not start qpdf merely to satisfy that guard. This does not require a dashboard source rebuild.

This report is an additional recovery document, outside the previously reviewed 21-file dashboard set. The reviewed roadmap and dashboard report remain unmodified.


## Subsequent authorized dashboard resume

The later DASHBOARD_STAGING_DEPLOY_RESUME_WITH_FAIL_CLOSED_SCANNER authorization
removed producer recovery as a dashboard deployment prerequisite. Operator confirmed
build `qwLCXFTd9EEGdvqaB9SZS` deployed successfully, one reader rejection, unchanged
scanner configuration and preserved staging startup. The earlier NOT_EXECUTED section
records the recovery checkpoint, not the final deployment state. Final UI evidence
and scope are in CUSTOMER_DASHBOARD_SIDEBAR_AND_OVERVIEW_STAGING.md. Producer BLOCKED,
scanner NOT_READY and reboot NOT_PROVEN remain current. The qpdf deploy guard was
adapted to the existing listening-socket model, without restarting qpdf.
