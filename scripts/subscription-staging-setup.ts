// Explicit operator-only synthetic setup; never reads env files or sends email.
import {randomUUID} from "node:crypto";
import {userInfo} from "node:os";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../src/generated/prisma/client";
import {z} from "zod";
import {changeBillingGrant} from "../src/infrastructure/subscriptions/grant";

const OWNER="prodaja@zivic-elektro.com", OPERATOR="zivic.darko79@gmail.com";
const NAME="SYNTHETIC — Subscription commercial acceptance";
const SLUG="synthetic-subscription-commercial-20260930";
let db:PrismaClient|undefined;
async function main(){
  if(userInfo().username!=="postgres")throw new Error("OPERATOR_REQUIRED");
  const args=z.tuple([z.enum(["grant","fixture","revoke"]),z.uuid(),z.uuid()]).parse(process.argv.slice(2));
  const [action,ownerId,operatorId]=args;
  db=new PrismaClient({adapter:new PrismaPg({host:"/var/run/postgresql",port:5433,database:"passvero_acceptance",user:"postgres",options:"-c role=passvero_migrator"})});
  const [target]=await db.$queryRaw<Array<{database:string;port:string}>>`SELECT current_database() AS database,current_setting('port') AS port`;
  if(target?.database!=="passvero_acceptance"||target.port!=="5433")throw new Error("STAGING_REQUIRED");
  const owner=await db.user.findFirst({where:{id:ownerId,email:OWNER},select:{id:true}});
  const operator=await db.user.findFirst({where:{id:operatorId,email:OPERATOR},select:{id:true}});
  if(!owner||!operator)throw new Error("CONFIRMED_IDENTITY_MISMATCH");
  const identities=await db.authIdentity.findMany({where:{userId:owner.id,provider:"BETTER_AUTH",revokedAt:null},select:{providerSubject:true}});
  if(identities.length!==1||!await db.authProviderUser.findFirst({where:{id:identities[0].providerSubject,email:OWNER,emailVerified:true},select:{id:true}}))throw new Error("VERIFIED_OWNER_REQUIRED");
  if(action!=="fixture"){
    const result=await changeBillingGrant(db,db,{action,email:OPERATOR,operator:"SUBSCRIPTION_MANUAL_COMMERCIAL_WORKFLOW_STAGING"});
    console.log(JSON.stringify({action,...result,productionChanges:"NONE"}));return;
  }
  const result=await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9302026,147)::text AS lock`;
    const existing=await tx.organization.findUnique({where:{slug:SLUG},select:{id:true,displayName:true,status:true,memberships:{select:{userId:true,role:true,status:true}},billingProfile:{select:{legalName:true}}}});
    if(existing){
      if(existing.displayName!==NAME||existing.status!=="ACTIVE"||existing.memberships.length!==1||existing.memberships[0].userId!==owner.id||existing.memberships[0].role!=="OWNER"||existing.memberships[0].status!=="ACTIVE"||existing.billingProfile?.legalName!=="SYNTHETIC TEST — NOT A LEGAL CUSTOMER")throw new Error("FIXTURE_DRIFT");
      return {status:"NO_CHANGE",organizationId:existing.id};
    }
    if(await tx.organization.count({where:{displayName:NAME}}))throw new Error("FIXTURE_NAME_CONFLICT");
    const org=await tx.organization.create({data:{displayName:NAME,slug:SLUG,status:"ACTIVE",timezone:"Europe/Zagreb",defaultLocale:"hr"}});
    await tx.membership.create({data:{organizationId:org.id,userId:owner.id,role:"OWNER",status:"ACTIVE",joinedAt:new Date()}});
    await tx.organizationBillingProfile.create({data:{organizationId:org.id,legalName:"SYNTHETIC TEST — NOT A LEGAL CUSTOMER",addressLine1:"Synthetic test address 1",city:"Synthetic",countryCode:"HR",billingEmail:OWNER,revision:1}});
    await tx.auditLog.create({data:{organizationId:org.id,actorId:operator.id,entityType:"ORGANIZATION",entityId:org.id,action:"SYNTHETIC_COMMERCIAL_FIXTURE_CREATED",summary:"Explicitly approved synthetic commercial acceptance fixture. No actual payment.",metadata:{synthetic:true,ownerId:owner.id},correlationId:randomUUID()}});
    return {status:"CREATED",organizationId:org.id};
  });
  console.log(JSON.stringify({...result,ownerId,subscriptionCreated:false,paymentRecorded:false,existingOrganizations:"UNCHANGED",productionChanges:"NONE"}));
}
void main().catch(()=>{console.error("STAGING_SETUP_STOP: inspect state before retry; no credentials logged");process.exitCode=1;}).finally(()=>db?.$disconnect());
