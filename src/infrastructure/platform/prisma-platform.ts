import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { billingSelect } from "@/src/application/billing/contracts";
import { platformDenied, type PlatformActor, type PlatformQuery, type OrganizationPage, type OrganizationDetail, type AccessRequestQuery, type AccessRequestPage } from "@/src/application/platform/service";

type Tx = Prisma.TransactionClient;
const organizationSelect = { id: true, displayName: true, status: true, createdAt: true } as const;
// Called only by the server runtime or privileged CLI. Never cached across requests.
export async function hasPlatformAccess(tx: Tx, actor: PlatformActor, auth: Pick<PrismaClient, "authProviderSession">): Promise<boolean> {
  const grant = await tx.platformGrant.findUnique({where:{userId:actor.currentUser.userId},select:{revokedAt:true}});
  if (!grant || grant.revokedAt !== null) return false;
  const session = await auth.authProviderSession.findUnique({where:{id:actor.providerSession.providerSessionId},select:{userId:true,expiresAt:true,createdAt:true,authprovideruser:{select:{emailVerified:true}}}});
  const now = Date.now();
  if (!session || !session.authprovideruser.emailVerified || session.expiresAt.getTime() <= now || session.createdAt.getTime() + 30 * 86400000 <= now) return false;
  return Boolean(await tx.authIdentity.findFirst({where:{userId:actor.currentUser.userId,provider:"BETTER_AUTH",providerSubject:session.userId,revokedAt:null},select:{id:true}}));
}
export class PrismaPlatform {
  constructor(private readonly prisma: PrismaClient, private readonly auth: Pick<PrismaClient, "authProviderSession">) {}
  authorize(actor: PlatformActor) { return hasPlatformAccess(this.prisma, actor, this.auth); }
  private read<T>(actor: PlatformActor, work: (tx: Tx) => Promise<T>) {
    return this.prisma.$transaction(async tx => {
      if (!await hasPlatformAccess(tx, actor, this.auth)) throw platformDenied();
      return work(tx);
    }, {isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  list(actor: PlatformActor, query: PlatformQuery): Promise<OrganizationPage> {
    return this.read(actor, async tx => {
      // Literal contains: escape SQL LIKE metacharacters before Prisma builds ILIKE.
      const q = query.q.replace(/[\\%_]/g, "\\$&");
      const rows = await tx.organization.findMany({
        where:{...(query.cursor ? {id:{gt:query.cursor}} : {}),...(q ? {OR:[{displayName:{contains:q,mode:"insensitive" as const}},{billingProfile:{is:{legalName:{contains:q,mode:"insensitive" as const}}}},{legalName:{contains:q,mode:"insensitive" as const}}]} : {})},
        orderBy:{id:"asc"},take:26,
        select:{...organizationSelect,billingProfile:{select:{organizationId:true}}},
      });
      return {items:rows.slice(0,25).map(({billingProfile,...row})=>({...row,hasBillingProfile:billingProfile!==null})),nextCursor:rows.length>25?rows[24].id:null};
    });
  }
  detail(actor: PlatformActor, id: string): Promise<OrganizationDetail | null> {
    return this.read(actor, async tx => {
      const row = await tx.organization.findUnique({where:{id},select:{...organizationSelect,billingProfile:{select:{...billingSelect,updatedAt:true}}}});
      return row ? {...row,hasBillingProfile:row.billingProfile!==null} : null;
    });
  }
  accessRequests(actor: PlatformActor, query: AccessRequestQuery): Promise<AccessRequestPage> {
    return this.read(actor, async tx => {
      const rows = await tx.accessRequest.findMany({
        where: {
          ...(query.status === "ALL" ? {} : {status: query.status}),
          ...(query.cursor ? {id: {gt: query.cursor}} : {}),
        },
        orderBy: {id: "asc"}, take: 26,
        select: {
          id: true, contactName: true, email: true, organizationDisplayName: true, locale: true,
          status: true, createdAt: true, decidedAt: true, deliveryStatus: true,
          deliveryAttempts: true, deliveredAt: true,
          adminNotification: {select:{status:true,attempts:true}},
        },
      });
      return {items: rows.slice(0, 25), nextCursor: rows.length > 25 ? rows[24].id : null};
    });
  }
}
