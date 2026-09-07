export type PassveroRuntimeEnvironment = "production" | "staging";

export class RuntimeEnvironmentConfigError extends Error {
  constructor() {
    super("Passvero runtime environment must be explicitly production or staging.");
    this.name = "RuntimeEnvironmentConfigError";
  }
}

// Pure parser. Only the server-only runtime boundary reads environment variables.
export function parseRuntimeEnvironment(value: unknown): PassveroRuntimeEnvironment {
  if (value !== "production" && value !== "staging") throw new RuntimeEnvironmentConfigError();
  return value;
}

export function getRuntimeDatabaseEndpoint(environment: PassveroRuntimeEnvironment) {
  return environment === "staging"
    ? { host: "127.0.0.1", port: "5433", database: "passvero_acceptance" } as const
    : { host: "127.0.0.1", port: "5432", database: "passvero" } as const;
}
