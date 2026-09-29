import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUserResolution } from "../auth/resolve-current-user";
import type { BillingValues } from "../billing/contracts";
import { ApplicationError } from "../errors/application-error";

export type PlatformActor = Extract<CurrentUserResolution, { status: "AUTHENTICATED" }>;
export const PLATFORM_ORGANIZATIONS_READ = "PLATFORM_ORGANIZATIONS_READ" as const;
export type PlatformAdminContext = PlatformActor & { permission: typeof PLATFORM_ORGANIZATIONS_READ; correlationId: string };
export type OrganizationRow = { id: string; displayName: string; status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION"; createdAt: Date; hasBillingProfile: boolean };
export type OrganizationDetail = OrganizationRow & { billingProfile: (BillingValues & { updatedAt: Date }) | null };
export type OrganizationPage = { items: OrganizationRow[]; nextCursor: string | null };
export const platformQuerySchema = z.object({
  q: z.string().trim().max(100).refine(value => !/[\u0000-\u001f\u007f]/.test(value)).default(""),
  cursor: z.uuid().nullable().default(null),
}).strict();
export type PlatformQuery = z.infer<typeof platformQuerySchema>;
export function platformDenied() {
  return new ApplicationError("FORBIDDEN", "PLATFORM_FORBIDDEN", "Access denied.", false);
}
export function createPlatformServices(deps: {
  resolve(headers: Headers): Promise<CurrentUserResolution>;
  authorize(actor: PlatformActor): Promise<boolean>;
  list(actor: PlatformActor, query: PlatformQuery): Promise<OrganizationPage>;
  detail(actor: PlatformActor, id: string): Promise<OrganizationDetail | null>;
}) {
  async function requireAccess(headers: Headers) {
    const actor = await deps.resolve(headers);
    if (actor.status !== "AUTHENTICATED" || !await deps.authorize(actor)) throw platformDenied();
    return { ...actor, permission: PLATFORM_ORGANIZATIONS_READ, correlationId: randomUUID() } satisfies PlatformAdminContext;
  }
  return {
    requireAccess,
    async list(headers: Headers, query: unknown) {
      const actor = await requireAccess(headers);
      return deps.list(actor, platformQuerySchema.parse(query));
    },
    async detail(headers: Headers, id: unknown) {
      const actor = await requireAccess(headers);
      return deps.detail(actor, z.uuid().parse(id));
    },
  };
}
