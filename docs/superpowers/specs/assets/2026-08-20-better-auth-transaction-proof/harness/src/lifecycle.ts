export type ProofPhase =
  | "UNCLAIMED"
  | "CLAIMED"
  | "ROOT_CREATED"
  | "IDENTITY_CREATED"
  | "DATA_INITIALIZED"
  | "POSTMASTER_STARTED"
  | "CLUSTER_IDENTITY_PROVEN"
  | "SCHEMA_APPLIED"
  | "PENDING_READY";

export interface CleanupObservation {
  readonly phase: ProofPhase;
  readonly rootExists: boolean;
  readonly postmasterProven: boolean;
  readonly listenerPresent: boolean;
  readonly fullIdentityProven: boolean;
  readonly pendingPrepared: boolean;
  readonly signal: "NONE" | "INT" | "TERM";
}

export interface CleanupPlan {
  readonly attemptClaimRetained: boolean;
  readonly stopProvenPostmaster: boolean;
  readonly deleteRootAfterStoppedChecks: boolean;
  readonly usePrevalidatedFailureMaterial: boolean;
  readonly forceFailure: boolean;
  readonly failureCode: "STOP_UNPROVEN_LISTENER" | "STOP_PARTIAL_PROOF" | "STOP_SIGNAL" | null;
}

export function planCleanup(observation: CleanupObservation): CleanupPlan {
  if (observation.phase === "UNCLAIMED") {
    return {
      attemptClaimRetained: false,
      stopProvenPostmaster: false,
      deleteRootAfterStoppedChecks: false,
      usePrevalidatedFailureMaterial: false,
      forceFailure: observation.signal !== "NONE",
      failureCode: observation.signal === "NONE" ? null : "STOP_SIGNAL",
    };
  }
  const signalFailure = observation.signal !== "NONE";
  const fullCleanup = observation.fullIdentityProven && observation.pendingPrepared;
  const unprovenListener = observation.listenerPresent && !observation.postmasterProven;
  return {
    attemptClaimRetained: true,
    stopProvenPostmaster: observation.postmasterProven,
    deleteRootAfterStoppedChecks: observation.rootExists && fullCleanup,
    usePrevalidatedFailureMaterial: !fullCleanup,
    forceFailure: signalFailure || !fullCleanup || unprovenListener,
    failureCode: signalFailure
      ? "STOP_SIGNAL"
      : unprovenListener
        ? "STOP_UNPROVEN_LISTENER"
        : fullCleanup
          ? null
          : "STOP_PARTIAL_PROOF",
  };
}
