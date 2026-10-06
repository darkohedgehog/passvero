import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUserResolution } from "../auth/resolve-current-user";
import type { BillingValues } from "../billing/contracts";
import { ApplicationError } from "../errors/application-error";

export type PlatformActor = Extract<CurrentUserResolution, { status: "AUTHENTICATED" }>;
export const PLATFORM_ORGANIZATIONS_READ = "PLATFORM_ORGANIZATIONS_READ" as const;
export const PLATFORM_ACCESS_REQUESTS_READ = "PLATFORM_ACCESS_REQUESTS_READ" as const;
export type PlatformAdminContext = PlatformActor & { permission: typeof PLATFORM_ORGANIZATIONS_READ | typeof PLATFORM_ACCESS_REQUESTS_READ; correlationId: string };
export type OrganizationRow = { id: string; displayName: string; status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_DELETION"; createdAt: Date; hasBillingProfile: boolean };
export type OrganizationDetail = OrganizationRow & { billingProfile: (BillingValues & { updatedAt: Date }) | null };
export type OrganizationPage = { items: OrganizationRow[]; nextCursor: string | null };
export const accessRequestQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).default("PENDING"),
  cursor: z.uuid().nullable().default(null),
}).strict();
export type AccessRequestQuery = z.infer<typeof accessRequestQuerySchema>;
export type AccessRequestRow = {
  id: string; contactName: string; email: string; organizationDisplayName: string; locale: string;
  status: string; createdAt: Date; decidedAt: Date | null; deliveryStatus: string;
  deliveryAttempts: number; deliveredAt: Date | null;
  adminNotification: {status:string;attempts:number} | null;
};
export type AccessRequestPage = { items: AccessRequestRow[]; nextCursor: string | null };
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
  accessRequests(actor: PlatformActor, query: AccessRequestQuery): Promise<AccessRequestPage>;
}) {
  async function requireAccess(headers: Headers, permission: PlatformAdminContext["permission"] = PLATFORM_ORGANIZATIONS_READ) {
    const actor = await deps.resolve(headers);
    if (actor.status !== "AUTHENTICATED" || !await deps.authorize(actor)) throw platformDenied();
    return { ...actor, permission, correlationId: randomUUID() } satisfies PlatformAdminContext;
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
    async accessRequests(headers: Headers, query: unknown) {
      // Read authority only; dashboard approval requires its independent onboarding grant.
      const actor = await requireAccess(headers, PLATFORM_ACCESS_REQUESTS_READ);
      return deps.accessRequests(actor, accessRequestQuerySchema.parse(query));
    },
  };
}
