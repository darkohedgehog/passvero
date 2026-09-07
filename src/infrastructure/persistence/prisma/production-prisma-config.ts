import { getRuntimeDatabaseEndpoint, parseRuntimeEnvironment } from "@/src/infrastructure/config/runtime-environment";

export type ProductionDatabaseConfigErrorCode =
  | "MISSING"
  | "PADDED"
  | "MALFORMED"
  | "SCHEME"
  | "ROLE"
  | "DATABASE"
  | "HOST"
  | "PORT";

const messages: Record<ProductionDatabaseConfigErrorCode, string> = {
  MISSING: "Production database configuration is required.",
  PADDED: "Production database configuration must not contain surrounding whitespace.",
  MALFORMED: "Production database configuration is invalid.",
  SCHEME: "Production database configuration must use direct PostgreSQL.",
  ROLE: "Production database configuration must use the runtime role.",
  DATABASE: "Production database configuration must target the selected runtime database.",
  HOST: "Production database configuration must use the local database host.",
  PORT: "Production database configuration must use the selected local database port.",
};

export class ProductionDatabaseConfigError extends Error {
  constructor(readonly code: ProductionDatabaseConfigErrorCode) {
    super(messages[code]);
    this.name = "ProductionDatabaseConfigError";
  }
}

export interface ProductionDatabaseConfig {
  readonly connectionString: string;
}

export function validateProductionDatabaseUrl(
  value: unknown,
  runtimeEnvironment: unknown,
): ProductionDatabaseConfig {
  const endpoint = getRuntimeDatabaseEndpoint(parseRuntimeEnvironment(runtimeEnvironment));
  if (typeof value !== "string" || value.length === 0) {
    throw new ProductionDatabaseConfigError("MISSING");
  }
  if (value !== value.trim()) {
    throw new ProductionDatabaseConfigError("PADDED");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProductionDatabaseConfigError("MALFORMED");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new ProductionDatabaseConfigError("SCHEME");
  }
  if (parsed.searchParams.has("user")) {
    throw new ProductionDatabaseConfigError("ROLE");
  }

  if (!parsed.password || value.includes("?") || value.includes("#") || /[\s\\]/u.test(value)) {
    throw new ProductionDatabaseConfigError("MALFORMED");
  }

  let user: string;
  let database: string;
  try {
    user = decodeURIComponent(parsed.username);
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new ProductionDatabaseConfigError("MALFORMED");
  }

  if (user !== "passvero_app") {
    throw new ProductionDatabaseConfigError("ROLE");
  }
  if (database !== endpoint.database) {
    throw new ProductionDatabaseConfigError("DATABASE");
  }

  if (parsed.hostname !== endpoint.host) throw new ProductionDatabaseConfigError("HOST");
  if (parsed.port !== endpoint.port) throw new ProductionDatabaseConfigError("PORT");

  return { connectionString: value };
}
