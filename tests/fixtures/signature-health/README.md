# Sanitized operator evidence

Source: srv1834647, ClamAV 1.5.3, operator read-only outputs on 2026-09-15.
Zone: Europe/Zagreb. No source machine timezone is inferred by tests.

- initial-download.log: first seven consecutive Freshclam lines preserved in the
  compatibility report for commit 145653d4acca76ad121fc5754e00b6d6108aa77a.
- incremental.log: consecutive original lines 50-56 supplied by the operator after
  terminal scrollback lost the beginning of the larger response. daily 28123 -> 28124.
- daemon-reload-excerpt.log: SELECTED lifecycle lines 76,80,84,199-203 from the
  supplied response. Paths replaced with <PATH_OR_URL>. It is NOT a complete log.

The initial and incremental excerpts have a gap. Concatenating them in a test is
an explicitly assembled scenario, NOT proof of uninterrupted staging history.
The incremental excerpt alone must fail the initialization/validation-history gate.
No actual database bytes, digital signatures or authenticated writer history are
included. Header-shaped bytes used in tests are synthetic and never authenticity proof.
The original larger supplement was truncated before Freshclam line 86; current
rotation metadata and full historical continuity were not recovered.
