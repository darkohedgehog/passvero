import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { billingSelect } from "@/src/application/billing/contracts";
import { addCalendarDays, addCalendarMonths, calendarAnchor, parseCommercialLocalDateTime } from "@/src/application/subscriptions/calendar";
import { anchorSchema, limitsSchema, snapshotSchema, type AcceptCommand, type CommercialActor, type CommercialSnapshot, type CommercialState, type OfferCommand, type PaidPeriodDto, type PaymentCommand, type RequestCommand, type RequestDto } from "@/src/application/subscriptions/contracts";
import { commercialError, paymentAllowed, type CommercialPersistence } from "@/src/application/subscriptions/service";

type Tx=Prisma.TransactionClient;
const OPEN=["REQUESTED","OFFERED","ACCEPTED"];
const requestInclude={organization:{select:{displayName:true}},offers:{orderBy:{revision:"desc" as const},take:1}} satisfies Prisma.CommercialRequestInclude;
type RequestRow=Prisma.CommercialRequestGetPayload<{include:typeof requestInclude}>;
type PaidRow=Prisma.SubscriptionPaidPeriodGetPayload<Record<string,never>>;
function requestDto(row:RequestRow):RequestDto {
 const offer=row.offers[0];
 if(![...OPEN,"PAID","REPLACED"].includes(row.status))throw commercialError("COMMERCIAL_INVALID_STATE","INVALID_STATE");
 return {id:row.id,organizationId:row.organizationId,organizationName:row.organization.displayName,planSlug:row.planSlug,months:row.months,status:row.status as RequestDto["status"],createdAt:row.createdAt.toISOString(),acceptedAt:row.acceptedAt?.toISOString()??null,offer:offer?{id:offer.id,createdAt:offer.createdAt.toISOString(),expiresAt:offer.expiresAt.toISOString(),reference:{issuer:offer.issuer,year:offer.referenceYear,number:offer.referenceNumber},snapshot:snapshotSchema.parse(offer.snapshot)}:null};
}
function paidDto(row:PaidRow):PaidPeriodDto {
 if(row.paymentKind!=="BANK_TRANSFER"&&row.paymentKind!=="SIMULATED_PAYMENT")throw commercialError("COMMERCIAL_INVALID_STATE","INVALID_STATE");
 return {id:row.id,planSlug:row.planSlug,start:row.startsAt.toISOString(),end:row.endsAt.toISOString(),paymentKind:row.paymentKind,snapshot:snapshotSchema.parse(row.snapshot)};
}
export class PrismaCommercial implements CommercialPersistence {
 constructor(private readonly db:PrismaClient,private readonly auth:Pick<PrismaClient,"authProviderSession">,private readonly options:{canonicalOrigin:string;runtimeEnvironment:string;now?:()=>Date}){}
 private now(){return this.options.now?.()??new Date();}
 private async identity(tx:Tx,actor:CommercialActor){
  const session=await this.auth.authProviderSession.findUnique({where:{id:actor.providerSession.providerSessionId},select:{userId:true,expiresAt:true,createdAt:true,authprovideruser:{select:{emailVerified:true}}}});
  const now=Date.now();
  if(!session||!session.authprovideruser.emailVerified||session.expiresAt.getTime()<=now||session.createdAt.getTime()+30*86400000<=now)return false;
  return Boolean(await tx.authIdentity.findFirst({where:{userId:actor.currentUser.userId,provider:"BETTER_AUTH",providerSubject:session.userId,revokedAt:null},select:{id:true}}));
 }
 async authorize(actor:CommercialActor){return this.operatorAccess(this.db,actor);}
 private async operatorAccess(tx:Tx,actor:CommercialActor){
  const grant=await tx.platformBillingGrant.findUnique({where:{userId:actor.currentUser.userId},select:{revokedAt:true}});
  return !!grant&&grant.revokedAt===null&&await this.identity(tx,actor);
 }
 private async access(tx:Tx,actor:CommercialActor,organizationId:string,operator:boolean,write=false){
  const org=await tx.organization.findUnique({where:{id:organizationId},select:{status:true}});
  if(!org||org.status!=="ACTIVE")throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");
  if(operator){if(!await this.operatorAccess(tx,actor))throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");return true;}
  if(!await this.identity(tx,actor))throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");
  const membership=await tx.membership.findUnique({where:{organizationId_userId:{organizationId,userId:actor.currentUser.userId}},select:{status:true,role:true}});
  if(!membership||membership.status!=="ACTIVE"||!['OWNER','ADMIN'].includes(membership.role)||(write&&membership.role!=="OWNER"))throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");
  return membership.role==="OWNER";
 }
 private async audit(tx:Tx,actor:CommercialActor,organizationId:string,requestId:string,action:string,metadata:Prisma.InputJsonObject={}){
  await tx.auditLog.create({data:{organizationId,actorId:actor.currentUser.userId,entityType:"COMMERCIAL_REQUEST",entityId:requestId,action,metadata,correlationId:randomUUID()}});
 }
 private async readState(tx:Tx,organizationId:string,canManage:boolean):Promise<CommercialState>{
  const now=this.now();
  const [requests,periods,billing,occupied,stored,organization]=await Promise.all([
   tx.commercialRequest.findMany({where:{organizationId},include:requestInclude,orderBy:{createdAt:"desc"},take:50}),
   tx.subscriptionPaidPeriod.findMany({where:{organizationId},orderBy:{startsAt:"asc"}}),
   tx.organizationBillingProfile.findUnique({where:{organizationId},select:{organizationId:true}}),
   tx.product.count({where:{organizationId,currentPublishedVersionId:{not:null}}}),tx.product.count({where:{organizationId}}),tx.organization.findUniqueOrThrow({where:{id:organizationId},select:{displayName:true}}),
  ]);
  return {organizationId,organizationName:organization.displayName,renewalPlanSlug:periods.at(-1)?.planSlug??null,canManage,hasBillingProfile:!!billing,requests:requests.map(requestDto),currentPeriod:periods.filter(p=>p.startsAt<=now&&p.endsAt>now).map(paidDto)[0]??null,futurePeriods:periods.filter(p=>p.startsAt>now).map(paidDto),coverageEnd:periods.at(-1)?.endsAt.toISOString()??null,occupiedPublishedProducts:occupied,storedProducts:stored};
 }
 async state(actor:CommercialActor,organizationId:string,operator:boolean){return this.db.$transaction(async tx=>this.readState(tx,organizationId,await this.access(tx,actor,organizationId,operator)),{isolationLevel:"RepeatableRead"});}
 async list(actor:CommercialActor){return this.db.$transaction(async tx=>{if(!await this.operatorAccess(tx,actor))throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");return (await tx.commercialRequest.findMany({where:{status:{in:OPEN}},include:requestInclude,orderBy:{createdAt:"asc"},take:100})).map(requestDto);});}
 private async mutate(actor:CommercialActor,organizationId:string,operator:boolean,work:(tx:Tx)=>Promise<void>){
  try{return await this.db.$transaction(async tx=>{
   // Organization is the common serialization point for request/accept/payment.
   await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id"=${organizationId}::uuid FOR UPDATE`;
   await this.access(tx,actor,organizationId,operator,true);
   await work(tx);return this.readState(tx,organizationId,true);
  },{timeout:15000});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw commercialError("COMMERCIAL_CONFLICT");throw error;}
 }
 private async latestCoverage(tx:Tx,organizationId:string){return tx.subscriptionPaidPeriod.findFirst({where:{organizationId},orderBy:{endsAt:"desc"}});}
 private async ensureSamePlan(tx:Tx,organizationId:string,slug:string){
  const latest=await this.latestCoverage(tx,organizationId);
  if(latest&&latest.planSlug!==slug)throw commercialError("COMMERCIAL_PLAN_CHANGE_UNSUPPORTED","INVALID_STATE");
  const existing=await tx.subscription.findUnique({where:{organizationId},include:{plan:{select:{slug:true}}}});
  if(existing&&!latest&&existing.status!=="TRIAL")throw commercialError("COMMERCIAL_EXISTING_SUBSCRIPTION_REQUIRES_REVIEW","INVALID_STATE");
 }
 async request(actor:CommercialActor,organizationId:string,input:RequestCommand){return this.mutate(actor,organizationId,false,async tx=>{
  const hash=createHash("sha256").update(JSON.stringify({planSlug:input.planSlug,months:input.months,replaceRequestId:input.replaceRequestId??null})).digest("hex");
  const previous=await tx.commercialRequest.findUnique({where:{organizationId_idempotencyKey:{organizationId,idempotencyKey:input.idempotencyKey}}});
  if(previous){if(previous.payloadHash!==hash)throw commercialError("COMMERCIAL_CONFLICT");return;}
  await this.ensureSamePlan(tx,organizationId,input.planSlug);
  const open=await tx.commercialRequest.findFirst({where:{organizationId,status:{in:OPEN}}});
  if(open?.id!==input.replaceRequestId&&(open||input.replaceRequestId))throw commercialError("COMMERCIAL_CONFLICT");
  if(open){await tx.commercialRequest.update({where:{id:open.id},data:{status:"REPLACED"}});await this.audit(tx,actor,organizationId,open.id,"COMMERCIAL_REQUEST_REPLACED");}
  const request=await tx.commercialRequest.create({data:{organizationId,idempotencyKey:input.idempotencyKey,payloadHash:hash,planSlug:input.planSlug,months:input.months,createdById:actor.currentUser.userId}});
  await this.audit(tx,actor,organizationId,request.id,"COMMERCIAL_REQUEST_CREATED");
 });}
 async accept(actor:CommercialActor,organizationId:string,input:AcceptCommand){return this.mutate(actor,organizationId,false,async tx=>{
  const request=await tx.commercialRequest.findFirst({where:{id:input.requestId,organizationId},include:requestInclude});
  if(!request)throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");
  if(request.acceptedOfferId===input.offerId&&(request.status==="ACCEPTED"||request.status==="PAID"))return;
  const offer=request.offers[0];
  if(request.status!=="OFFERED"||!offer||offer.id!==input.offerId)throw commercialError("COMMERCIAL_CONFLICT");
  if(offer.expiresAt<=this.now())throw commercialError("COMMERCIAL_OFFER_EXPIRED","INVALID_STATE");
  await tx.commercialRequest.update({where:{id:request.id},data:{status:"ACCEPTED",acceptedOfferId:offer.id,acceptedAt:this.now()}});
  await this.audit(tx,actor,organizationId,request.id,"COMMERCIAL_OFFER_ACCEPTED",{offerId:offer.id});
 });}
 private async requestOrganization(actor:CommercialActor,requestId:string){
  if(!await this.authorize(actor))throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");
  const request=await this.db.commercialRequest.findUnique({where:{id:requestId},select:{organizationId:true}});
  if(!request)throw commercialError("COMMERCIAL_INVALID_STATE","INVALID_STATE");return request.organizationId;
 }
 async offer(actor:CommercialActor,input:OfferCommand){
  const organizationId=await this.requestOrganization(actor,input.requestId);
  return this.mutate(actor,organizationId,true,async tx=>{
   const request=await tx.commercialRequest.findUniqueOrThrow({where:{id:input.requestId}});
   if(!["REQUESTED","OFFERED"].includes(request.status))throw commercialError("COMMERCIAL_CONFLICT");
   await this.ensureSamePlan(tx,organizationId,request.planSlug);
   const billing=await tx.organizationBillingProfile.findUnique({where:{organizationId},select:{...billingSelect,revision:true}});
   if(!billing)throw commercialError("COMMERCIAL_BILLING_PROFILE_REQUIRED","INVALID_STATE");
   const {revision,...billingProfile}=billing;
   const months=request.months===3?3:12;
   const plan=await tx.plan.findUnique({where:{slug:request.planSlug}});
   if(!plan||plan.status!=="ACTIVE"||plan.currencyCode!=="EUR")throw commercialError("COMMERCIAL_CATALOG_UNAVAILABLE","INVALID_STATE");
   let limits;
   if(request.planSlug==="custom"){
    if(!input.customLimits)throw commercialError("COMMERCIAL_CUSTOM_LIMITS_REQUIRED","INVALID_STATE");limits=limitsSchema.parse(input.customLimits);
   }else{
    if(request.planSlug!=="start"&&request.planSlug!=="business"&&request.planSlug!=="pro")throw commercialError("COMMERCIAL_INVALID_STATE","INVALID_STATE");
    const price=months===3?plan.quarterlyPrice:plan.yearlyPrice;
    if(!price||input.netAmountCents!==price.mul(100).toNumber()||input.customLimits)throw commercialError("COMMERCIAL_PRICE_MISMATCH","INVALID_STATE");
    const features=plan.features as Record<string,unknown>;
    limits=limitsSchema.parse({maxPublishedProducts:plan.maxActivePassports,maxStoredProducts:plan.maxProducts,maxStorageBytes:plan.maxStorageBytes===null?null:Number(plan.maxStorageBytes),maxPdfAttachments:features.maxPdfAttachments});
   }
   const now=this.now(),issuedAt=parseCommercialLocalDateTime(input.issuedAtLocal),expiresAt=addCalendarDays(issuedAt,30);
   if(issuedAt>now)throw commercialError("COMMERCIAL_OFFER_ISSUANCE_INVALID","INVALID_STATE");
   if(expiresAt<=now)throw commercialError("COMMERCIAL_OFFER_EXPIRED","INVALID_STATE");
   const coverage=await this.latestCoverage(tx,organizationId);
   if(request.planSlug==="custom"&&coverage){
    const previous=snapshotSchema.parse(coverage.snapshot).limits;
    if(Object.keys(previous).some(key=>previous[key as keyof typeof previous]!==limits[key as keyof typeof limits]))throw commercialError("COMMERCIAL_PLAN_CHANGE_UNSUPPORTED","INVALID_STATE");
   }
   const start=coverage&&coverage.endsAt>now?coverage.endsAt:null;
   const anchor=start&&coverage?anchorSchema.parse(coverage.anchor):null;
   const snapshot:CommercialSnapshot={version:1,offerIssuedAt:issuedAt.toISOString(),planSlug:request.planSlug as CommercialSnapshot["planSlug"],months,currency:"EUR",netAmountCents:input.netAmountCents,totalAmountCents:input.totalAmountCents,taxTreatment:input.taxTreatment,termsVersion:input.termsVersion,limits,billingProfile,billingRevision:revision,timezone:"Europe/Zagreb",startPolicy:start?"CONTIGUOUS_RENEWAL":"ON_PAYMENT",scheduledStart:start?.toISOString()??null,scheduledEnd:start?addCalendarMonths(start,months,anchor??undefined).toISOString():null,anchor,publicRetentionMonths:6,privateRetentionMonths:12};
   const latestOffer=await tx.commercialOffer.findFirst({where:{requestId:request.id},orderBy:{revision:"desc"},select:{revision:true}});
   const offer=await tx.commercialOffer.create({data:{revision:(latestOffer?.revision??0)+1,requestId:request.id,issuer:input.reference.issuer,referenceYear:input.reference.year,referenceNumber:input.reference.number,snapshot,createdById:actor.currentUser.userId,createdAt:now,expiresAt}});
   await tx.commercialRequest.update({where:{id:request.id},data:{status:"OFFERED"}});
   await this.audit(tx,actor,organizationId,request.id,"COMMERCIAL_OFFER_RECORDED",{offerId:offer.id});
  });
 }
 async pay(actor:CommercialActor,input:PaymentCommand){
  if(!paymentAllowed(input.kind,this.options.canonicalOrigin,this.options.runtimeEnvironment))throw commercialError("COMMERCIAL_SIMULATION_FORBIDDEN","FORBIDDEN");
  const organizationId=await this.requestOrganization(actor,input.requestId);
  return this.mutate(actor,organizationId,true,async tx=>{
   const request=await tx.commercialRequest.findUniqueOrThrow({where:{id:input.requestId},include:{acceptedOffer:true,paidPeriod:true}});
   if(request.paidPeriod){
    const paid=request.paidPeriod;
    if(paid.offerId!==input.offerId||paid.paymentKind!==input.kind||paid.issuer!==input.reference.issuer||paid.referenceYear!==input.reference.year||paid.referenceNumber!==input.reference.number)throw commercialError("COMMERCIAL_CONFLICT");return;
   }
   const offer=request.acceptedOffer,now=this.now();
   if(request.status!=="ACCEPTED"||!offer||offer.id!==input.offerId)throw commercialError("COMMERCIAL_CONFLICT");
   if(offer.expiresAt<=now)throw commercialError("COMMERCIAL_OFFER_EXPIRED","INVALID_STATE");
   await this.ensureSamePlan(tx,organizationId,request.planSlug);
   const snapshot=snapshotSchema.parse(offer.snapshot),coverage=await this.latestCoverage(tx,organizationId);
   let start=now,anchor=calendarAnchor(now);
   if(snapshot.startPolicy==="CONTIGUOUS_RENEWAL"){
    if(!coverage||coverage.endsAt<=now||coverage.endsAt.toISOString()!==snapshot.scheduledStart||!snapshot.anchor)throw commercialError("COMMERCIAL_OFFER_REQUIRES_REPLACEMENT","INVALID_STATE");
    start=coverage.endsAt;anchor=snapshot.anchor;
   }else if(coverage&&coverage.endsAt>now)throw commercialError("COMMERCIAL_CONFLICT");
   const end=addCalendarMonths(start,snapshot.months,anchor);
   if(snapshot.scheduledEnd&&snapshot.scheduledEnd!==end.toISOString())throw commercialError("COMMERCIAL_CONFLICT");
   const period=await tx.subscriptionPaidPeriod.create({data:{organizationId,requestId:request.id,offerId:offer.id,planSlug:request.planSlug,startsAt:start,endsAt:end,anchor,snapshot,paymentKind:input.kind,issuer:input.reference.issuer,referenceYear:input.reference.year,referenceNumber:input.reference.number,confirmedById:actor.currentUser.userId,confirmedAt:now}});
   // Store only the effective interval in the mutable projection; future coverage lives in receipts.
   const current=await tx.subscriptionPaidPeriod.findFirst({where:{organizationId,startsAt:{lte:now},endsAt:{gt:now}},orderBy:{startsAt:"desc"}});
   if(current){
    const plan=await tx.plan.findUnique({where:{slug:current.planSlug},select:{id:true}});
    if(!plan)throw commercialError("COMMERCIAL_CATALOG_UNAVAILABLE","INVALID_STATE");
    const projection={planId:plan.id,status:"ACTIVE" as const,billingProvider:"MANUAL" as const,currentPeriodStart:current.startsAt,currentPeriodEnd:current.endsAt,cancelAtPeriodEnd:false,canceledAt:null,externalCustomerId:null,externalSubscriptionId:null,providerConfigurationKey:null};
    await tx.subscription.upsert({where:{organizationId},create:{organizationId,...projection},update:projection});
   }
   await tx.commercialRequest.update({where:{id:request.id},data:{status:"PAID"}});
   await this.audit(tx,actor,organizationId,request.id,"COMMERCIAL_PAYMENT_CONFIRMED",{offerId:offer.id,periodId:period.id,paymentKind:input.kind});
  });
 }
}
