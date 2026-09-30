import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
export const grantCommandSchema = z.object({
  action:z.enum(["grant","revoke"]),
  email:z.email().max(254).transform(value=>value.trim().toLowerCase()),
  operator:z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._@ -]+$/),
}).strict();
export class BillingGrantError extends Error {
  constructor(readonly code: string) { super(code); }
}
export async function changeBillingGrant(prisma: PrismaClient, auth: Pick<PrismaClient, "authProviderUser">, input: unknown) {
  const command = grantCommandSchema.parse(input);
  return prisma.$transaction(async tx=>{
    const user = await tx.user.findUnique({where:{email:command.email},select:{id:true}});
    if (!user) throw new BillingGrantError("USER_NOT_FOUND");
    if (command.action === "grant") {
      const identities = await tx.authIdentity.findMany({where:{userId:user.id,provider:"BETTER_AUTH",revokedAt:null},select:{providerSubject:true}});
      if (identities.length !== 1 || !await auth.authProviderUser.findFirst({where:{id:identities[0].providerSubject,email:command.email,emailVerified:true},select:{id:true}})) throw new BillingGrantError("VERIFIED_IDENTITY_REQUIRED");
    }
    const current = await tx.platformBillingGrant.findUnique({where:{userId:user.id}});
    const active = current !== null && current.revokedAt === null;
    if (active === (command.action === "grant")) return {status:"NO_CHANGE" as const,userId:user.id};
    if (command.action === "grant") {
      if (current) await tx.platformBillingGrant.update({where:{userId:user.id},data:{grantedAt:new Date(),revokedAt:null}});
      else await tx.platformBillingGrant.create({data:{userId:user.id}});
    } else await tx.platformBillingGrant.update({where:{userId:user.id},data:{revokedAt:new Date()}});
    await tx.authAuditEvent.create({data:{userId:user.id,action:command.action === "grant" ? "PLATFORM_BILLING_ACCESS_GRANTED" : "PLATFORM_BILLING_ACCESS_REVOKED",summary:"Explicit operator billing authorization change.",metadata:{operator:command.operator},correlationId:randomUUID()}});
    return {status:command.action === "grant" ? "GRANTED" as const : "REVOKED" as const,userId:user.id};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
