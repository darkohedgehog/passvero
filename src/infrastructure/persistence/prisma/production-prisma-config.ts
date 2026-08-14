export type ProductionDatabaseConfigErrorCode =
  | "MISSING"
  | "PADDED"
  | "MALFORMED"
  | "SCHEME"
  | "ROLE"
  | "DATABASE";

const messages: Record<ProductionDatabaseConfigErrorCode, string> = {
  MISSING: "Production database configuration is required.",
  PADDED: "Production database configuration must not contain surrounding whitespace.",
  MALFORMED: "Production database configuration is invalid.",
  SCHEME: "Production database configuration must use direct PostgreSQL.",
  ROLE: "Production database configuration must use the runtime role.",
  DATABASE: "Production database configuration must target the production database.",
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
): ProductionDatabaseConfig {
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
  if (database !== "passvero") {
    throw new ProductionDatabaseConfigError("DATABASE");
  }

  return { connectionString: value };
}
