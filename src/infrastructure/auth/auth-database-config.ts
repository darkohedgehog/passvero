export type AuthDatabaseConfigErrorCode =
  | "MISSING"
  | "PADDED"
  | "MALFORMED"
  | "SCHEME"
  | "ROLE"
  | "DATABASE"
  | "HOST"
  | "PORT";

const messages: Record<AuthDatabaseConfigErrorCode, string> = {
  MISSING: "Authentication database configuration is required.",
  PADDED: "Authentication database configuration must not contain surrounding whitespace.",
  MALFORMED: "Authentication database configuration is invalid.",
  SCHEME: "Authentication database configuration must use direct PostgreSQL.",
  ROLE: "Authentication database configuration must use the dedicated auth role.",
  DATABASE: "Authentication database configuration must target the production database.",
  HOST: "Authentication database configuration must use the local database host.",
  PORT: "Authentication database configuration must use the local database port.",
};

export class AuthDatabaseConfigError extends Error {
  constructor(readonly code: AuthDatabaseConfigErrorCode) {
    super(messages[code]);
    this.name = "AuthDatabaseConfigError";
  }
}

export interface AuthDatabaseConfig {
  readonly connectionString: string;
}

export function validateAuthDatabaseUrl(value: unknown): AuthDatabaseConfig {
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthDatabaseConfigError("MISSING");
  }
  if (value !== value.trim()) {
    throw new AuthDatabaseConfigError("PADDED");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AuthDatabaseConfigError("MALFORMED");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new AuthDatabaseConfigError("SCHEME");
  }
  if (parsed.password.length === 0) {
    throw new AuthDatabaseConfigError("MALFORMED");
  }
  if (parsed.search.length > 0) {
    throw new AuthDatabaseConfigError("MALFORMED");
  }

  let user: string;
  let database: string;
  try {
    user = decodeURIComponent(parsed.username);
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new AuthDatabaseConfigError("MALFORMED");
  }

  if (user !== "passvero_auth") {
    throw new AuthDatabaseConfigError("ROLE");
  }
  if (database !== "passvero") {
    throw new AuthDatabaseConfigError("DATABASE");
  }
  if (parsed.hostname !== "127.0.0.1") {
    throw new AuthDatabaseConfigError("HOST");
  }
  if (parsed.port !== "5432") {
    throw new AuthDatabaseConfigError("PORT");
  }

  return { connectionString: value };
}
