# Better Auth transaction proof evidence companion

POST-EXECUTION RECONCILIATION: this corrected public artifact was not generated
by the publisher executed at `d1f350627c3da72feaa18eb5416ff17e07db81a8`.
It preserves the historical execution facts without changing the executed proof
source or rerunning the proof.
The JSON file is the authoritative corrected public record; this Markdown is
its companion.

- Overall status: `FAIL`
- Invocation count: `1`
- Retry count: `0`
- Failure phase: `PRE_HYPOTHESIS_SCHEMA_PREPARATION_INCOMPLETE`
- Failure code: `STOP_PRE_EVIDENCE_FAILURE`
- Exact cause: unavailable; it was not retained in committed public evidence

| Hypothesis | Status | Reason | Runtime observations |
| --- | --- | --- | --- |
| H1_NATIVE_TRANSACTION | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |
| H2_DIRECT_API_OUTER_TRANSACTION | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |
| H3_HANDLER_CONTEXT_REPLACEMENT | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |
| H4_CONTROLLED_ACTIVATION | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |
| H5_SESSION_COOKIE_AFTER_COMMIT | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |
| H6_RECOVERY_AND_REVOCATION | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |
| H7_ROUTE_EXPOSURE | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |

Cleanup status: `FAIL_RETAINED`

- `serverStopped=true`
- `listenerGone=true`
- `pidGone=true`
- `rootGone=false`

The retained root remains unchanged. Disposal requires separate explicit
exact-target authorization and a reviewed cleanup procedure. A future disposal
must not rewrite the historical `rootGone=false` value or `FAIL_RETAINED`
cleanup status.
