import { Prisma,type PrismaClient } from "@/src/generated/prisma/client";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { ApplicationError } from "@/src/application/errors/application-error";
import { billingPermissionsForRole } from "@/src/application/permissions/billing-permissions";
import { billingSelect,type BillingCommand,type BillingProfile } from "@/src/application/billing/contracts";
import { billingError,type BillingPersistence } from "@/src/application/billing/service";
type Tx=Prisma.TransactionClient;
export class PrismaBillingPersistence implements BillingPersistence {
  constructor(private readonly prisma:PrismaClient) {}
  private async run<T>(context:AuthenticatedUserContext,write:boolean,work:(tx:Tx)=>Promise<T>) {
    try {
      return await this.prisma.$transaction(async tx=>{
        // Revalidate canonical identity and tenant eligibility inside the serializable transaction.
        const member=await tx.membership.findFirst({where:{id:context.membershipId,userId:context.userId,organizationId:context.organizationId,status:"ACTIVE",organization:{status:"ACTIVE"}},select:{role:true,user:{select:{id:true}}}});
        if(!member || !billingPermissionsForRole(member.role).includes(write?"BILLING_PROFILE_UPDATE":"BILLING_PROFILE_READ"))throw billingError("FORBIDDEN","FORBIDDEN");
        return work(tx);
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    } catch(error) {
      if(error instanceof ApplicationError)throw error;
      if(error instanceof Prisma.PrismaClientKnownRequestError && ["P2002","P2034"].includes(error.code))throw billingError("CONFLICT","STALE_WRITE");
      throw billingError("INTERNAL","OPERATIONAL_FAILURE");
    }
  }
  get(context:AuthenticatedUserContext):Promise<BillingProfile|null> {
    return this.run(context,false,async tx=>{
      const row=await tx.organizationBillingProfile.findUnique({where:{organizationId:context.organizationId},select:{...billingSelect,revision:true}});
      if(!row)return null;
      const {revision,...values}=row;return {revision,values};
    });
  }
  save(context:AuthenticatedUserContext,command:BillingCommand) {
    return this.run(context,true,async tx=>{
      const where={organizationId:context.organizationId};
      const current=await tx.organizationBillingProfile.findUnique({where,select:{...billingSelect,revision:true}});
      if((current?.revision??0)!==command.expectedRevision)throw billingError("CONFLICT","STALE_WRITE");
      if(current && Object.keys(billingSelect).every(key=>current[key as keyof typeof billingSelect]===command.values[key as keyof typeof billingSelect]))return {status:"NO_CHANGE" as const,revision:current.revision};
      const revision=command.expectedRevision+1;
      if(current) {
        const result=await tx.organizationBillingProfile.updateMany({where:{...where,revision:command.expectedRevision},data:{...command.values,revision}});
        if(result.count!==1)throw billingError("CONFLICT","STALE_WRITE");
      } else await tx.organizationBillingProfile.create({data:{...where,...command.values,revision}});
      await tx.auditLog.create({data:{...where,actorId:context.userId,action:current?"BILLING_PROFILE_UPDATED":"BILLING_PROFILE_CREATED",entityType:"ORGANIZATION_BILLING_PROFILE",entityId:context.organizationId,summary:"Private billing profile saved.",metadata:{revision},correlationId:context.correlationId}});
      return {status:"SAVED" as const,revision};
    });
  }
}
