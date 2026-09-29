import { getAuthPrismaClient, disconnectBetterAuthServer } from "/Users/darkozivic/Desktop/Programiranje/passvero/src/infrastructure/auth/better-auth-server";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "/Users/darkozivic/Desktop/Programiranje/passvero/src/generated/prisma/client";
let operator: PrismaClient | undefined;
let step="construct-operator";
function safeError(error: unknown) {
 const object=typeof error==="object" && error!==null ? error as Record<string,unknown> : {};
 const cause=typeof object.cause==="object" && object.cause!==null ? object.cause as Record<string,unknown> : {};
 const message=error instanceof Error?error.message:"";
 const codes=[object.code,cause.code,cause.originalCode].filter((value):value is string=>typeof value==="string" && /^(?:P\d{4}|[0-9A-Z]{5}|[A-Z_]{3,64})$/.test(value));
 const category=/permission denied/i.test(message)?"PERMISSION_DENIED":/authentication failed|no pg_hba/i.test(message)?"DB_AUTHENTICATION":/cannot find module|cannot find package/i.test(message)?"MODULE_RESOLUTION":/connect|ECONNREFUSED/i.test(message)?"DB_CONNECTION":/wasm|compiler/i.test(message)?"QUERY_COMPILER":/configuration/i.test(message)?"CONFIGURATION":"OTHER";
 return {codes,category};
}
async function probe() {
 try {
  operator=new PrismaClient({adapter:new PrismaPg({host:"/var/run/postgresql",port:5433,database:"passvero_acceptance",user:"postgres",options:"-c role=passvero_migrator -c default_transaction_read_only=on"})});
  step="construct-auth";const auth=getAuthPrismaClient();
  step="read-operator";
  await operator.$transaction(async tx=>{
   await tx.$executeRaw`SET TRANSACTION READ ONLY`;
   const user=await tx.user.findUnique({where:{id:process.argv[2]},select:{id:true}});
   if(!user)throw new Error("Canonical user missing");
   step="read-identities";
   const identities=await tx.authIdentity.findMany({where:{userId:user.id,provider:"BETTER_AUTH",revokedAt:null},select:{providerSubject:true}});
   step="read-grant";await tx.platformGrant.findUnique({where:{userId:user.id},select:{revokedAt:true}});
   step="read-audit";await tx.authAuditEvent.findFirst({where:{userId:user.id},select:{id:true}});
   step="read-auth";
   if(identities.length===1)await auth.$transaction(async authTx=>{
    await authTx.$executeRaw`SET TRANSACTION READ ONLY`;
    await authTx.authProviderUser.findUnique({where:{id:identities[0].providerSubject},select:{id:true,emailVerified:true}});
   });
  });
  process.stdout.write(JSON.stringify({probe:"PASS",step:"read-only-complete"})+"\n");
 } catch(error) {process.stdout.write(JSON.stringify({probe:"FAIL",step,...safeError(error)})+"\n");}
 finally {try {await Promise.all([operator?.$disconnect(),disconnectBetterAuthServer()]);}catch(error){process.stdout.write(JSON.stringify({probe:"CLEANUP_FAIL",...safeError(error)})+"\n");}}
}
void probe();
