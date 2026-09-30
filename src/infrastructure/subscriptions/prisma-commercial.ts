import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { billingSelect } from "@/src/application/billing/contracts";
import { addCalendarDays, addCalendarMonths, calendarAnchor, parseCommercialLocalDateTime } from "@/src/application/subscriptions/calendar";
import { anchorSchema, limitsSchema, snapshotSchema, type AcceptCommand, type CommercialActor, type CommercialSnapshot, type CommercialState, type OfferCommand, type PaidPeriodDto, type PaymentCommand, type RequestCommand, type RequestDto } from "@/src/application/subscriptions/contracts";
import { commercialError, paymentAllowed, type CommercialPersistence } from "@/src/application/subscriptions/service";

import { lockEntitlementOrganization, readEntitlements, readEntitlementUsage } from "./entitlement-runtime";
import { quotaDenials } from "@/src/application/subscriptions/entitlements";

type Tx=Prisma.TransactionClient;
const OPEN=["REQUESTED","OFFERED","ACCEPTED"];
const requestInclude={organization:{select:{displayName:true}},offers:{orderBy:{revision:"desc" as const},take:1}} satisfies Prisma.CommercialRequestInclude;
type RequestRow=Prisma.CommercialRequestGetPayload<{include:typeof requestInclude}>;
type PaidRow=Prisma.SubscriptionPaidPeriodGetPayload<Record<string,never>>;
function requestDto(row:RequestRow):RequestDto {
 const offer=row.offers[0];
 if(![...OPEN,"PAID","REPLACED"].includes(row.status))throw commercialError("COMMERCIAL_INVALID_STATE","INVALID_STATE");
 return {id:row.id,organizationId:row.organizationId,organizationName:row.organization.displayName,planSlug:row.planSlug,months:row.months,changeKind:row.changeKind as RequestDto["changeKind"],status:row.status as RequestDto["status"],createdAt:row.createdAt.toISOString(),acceptedAt:row.acceptedAt?.toISOString()??null,offer:offer?{id:offer.id,createdAt:offer.createdAt.toISOString(),expiresAt:offer.expiresAt.toISOString(),reference:{issuer:offer.issuer,year:offer.referenceYear,number:offer.referenceNumber},snapshot:snapshotSchema.parse(offer.snapshot)}:null};
}
function paidDto(row:PaidRow):PaidPeriodDto {
 if(row.paymentKind!=="BANK_TRANSFER"&&row.paymentKind!=="SIMULATED_PAYMENT")throw commercialError("COMMERCIAL_INVALID_STATE","INVALID_STATE");
 return {id:row.id,planSlug:row.planSlug,start:row.startsAt.toISOString(),end:row.endsAt.toISOString(),paymentKind:row.paymentKind,snapshot:snapshotSchema.parse(row.snapshot)};
}
function unresolvedReplacementPeriod(periods: Array<PaidRow & {activation:{status:string}|null}>) {
 const replaced=new Set(periods.flatMap(period=>{
  const snapshot=snapshotSchema.parse(period.snapshot);
  return snapshot.version===2&&snapshot.changeKind==="REPLACEMENT"&&snapshot.basePeriodId?[snapshot.basePeriodId]:[];
 }));
 return periods.filter(period=>period.activation?.status==="BLOCKED_REQUIRES_OPERATOR"&&!replaced.has(period.id)).sort((a,b)=>b.endsAt.getTime()-a.endsAt.getTime())[0]??null;
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
 async authorize(actor:CommercialActor,transaction:Tx=this.db){return this.operatorAccess(transaction,actor);}
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
  const entitlement=await readEntitlements(tx,organizationId,now);
  const [requests,periods,billing,occupied,stored,organization]=await Promise.all([
   tx.commercialRequest.findMany({where:{organizationId},include:requestInclude,orderBy:{createdAt:"desc"},take:50}),
   tx.subscriptionPaidPeriod.findMany({where:{organizationId},include:{activation:true},orderBy:{startsAt:"asc"}}),
   tx.organizationBillingProfile.findUnique({where:{organizationId},select:{organizationId:true}}),
   tx.product.count({where:{organizationId,currentPublishedVersionId:{not:null}}}),tx.product.count({where:{organizationId}}),tx.organization.findUniqueOrThrow({where:{id:organizationId},select:{displayName:true}}),
  ]);
  const usage=await readEntitlementUsage(tx,organizationId);
  const displayPeriod=(p:typeof periods[number]):PaidPeriodDto=>({...paidDto(p),activationStatus:p.activation?.status,activationReasons:Array.isArray(p.activation?.reasons)?p.activation.reasons.filter((v):v is string=>typeof v==="string"):[]});
  const current=periods.find(p=>p.id===entitlement.periodId&&entitlement.kind==="PAID");
  const currentPeriod=current?displayPeriod(current):null;
  if(currentPeriod&&entitlement.limits){currentPeriod.planSlug=entitlement.planSlug!;currentPeriod.snapshot={...currentPeriod.snapshot,planSlug:entitlement.planSlug as CommercialSnapshot["planSlug"],limits:entitlement.limits};}
  return {unresolvedReplacementPeriodId:unresolvedReplacementPeriod(periods)?.id??null,entitlements:{kind:entitlement.kind,planSlug:entitlement.planSlug,end:entitlement.end?.toISOString()??null,limits:entitlement.limits,blockedReasons:entitlement.blockedReasons},usage,organizationId,organizationName:organization.displayName,renewalPlanSlug:periods.at(-1)?.id===entitlement.periodId&&entitlement.kind==="PAID"?entitlement.planSlug:periods.at(-1)?.planSlug??null,canManage,hasBillingProfile:!!billing,requests:requests.map(row=>{const dto=requestDto(row),snapshot=dto.offer?.snapshot;return {...dto,currentWarnings:snapshot?.version===2&&snapshot.changeKind==="DOWNGRADE"?quotaDenials(snapshot.limits,usage,{}):[]};}),currentPeriod:currentPeriod,futurePeriods:periods.filter(p=>p.startsAt>now||p.activation?.status==="BLOCKED_REQUIRES_OPERATOR").map(displayPeriod),coverageEnd:periods.at(-1)?.endsAt.toISOString()??null,occupiedPublishedProducts:occupied,storedProducts:stored};
 }
 async state(actor:CommercialActor,organizationId:string,operator:boolean){return this.db.$transaction(async tx=>this.readState(tx,organizationId,await this.access(tx,actor,organizationId,operator)),{timeout:15000});}
 async list(actor:CommercialActor){return this.db.$transaction(async tx=>{if(!await this.operatorAccess(tx,actor))throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");return (await tx.commercialRequest.findMany({where:{status:{in:OPEN}},include:requestInclude,orderBy:{createdAt:"asc"},take:100})).map(requestDto);});}
 private async mutate(actor:CommercialActor,organizationId:string,operator:boolean,work:(tx:Tx)=>Promise<void>){
  try{return await this.db.$transaction(async tx=>{
   await lockEntitlementOrganization(tx,organizationId);
   // Organization is the common serialization point for request/accept/payment.
   await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id"=${organizationId}::uuid FOR UPDATE`;
   await this.access(tx,actor,organizationId,operator,true);
   await work(tx);return this.readState(tx,organizationId,true);
  },{timeout:15000});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw commercialError("COMMERCIAL_CONFLICT");throw error;}
 }
 private async unresolvedReplacement(tx:Tx,organizationId:string){
  return unresolvedReplacementPeriod(await tx.subscriptionPaidPeriod.findMany({where:{organizationId},include:{activation:true}}));
 }
 private async latestCoverage(tx:Tx,organizationId:string){return tx.subscriptionPaidPeriod.findFirst({where:{organizationId},orderBy:{endsAt:"desc"}});}
 private async ensureSamePlan(tx:Tx,organizationId:string,slug:string){
  const latest=await this.latestCoverage(tx,organizationId);
  if(await this.unresolvedReplacement(tx,organizationId))throw commercialError("COMMERCIAL_OFFER_REQUIRES_REPLACEMENT","INVALID_STATE");
  const effective=await readEntitlements(tx,organizationId,this.now());
  const renewalSlug=latest?.id===effective.periodId&&effective.kind==="PAID"?effective.planSlug:latest?.planSlug;
  if(latest&&renewalSlug!==slug)throw commercialError("COMMERCIAL_PLAN_CHANGE_UNSUPPORTED","INVALID_STATE");
  const existing=await tx.subscription.findUnique({where:{organizationId},include:{plan:{select:{slug:true}}}});
  if(existing&&!latest&&existing.status!=="TRIAL")throw commercialError("COMMERCIAL_EXISTING_SUBSCRIPTION_REQUIRES_REVIEW","INVALID_STATE");
 }
 async request(actor:CommercialActor,organizationId:string,input:RequestCommand){input={...input,changeKind:input.changeKind??"STANDARD"};return this.mutate(actor,organizationId,false,async tx=>{
  const hash=createHash("sha256").update(JSON.stringify({planSlug:input.planSlug,months:input.months,replaceRequestId:input.replaceRequestId??null,...(input.changeKind!=="STANDARD"?{changeKind:input.changeKind}:{})})).digest("hex");
  const previous=await tx.commercialRequest.findUnique({where:{organizationId_idempotencyKey:{organizationId,idempotencyKey:input.idempotencyKey}}});
  if(previous){if(previous.payloadHash!==hash)throw commercialError("COMMERCIAL_CONFLICT");return;}
  if(input.changeKind==="STANDARD")await this.ensureSamePlan(tx,organizationId,input.planSlug);
  else if(input.changeKind==="REPLACEMENT"){
   const blocked=await this.unresolvedReplacement(tx,organizationId);
   if(!blocked)throw commercialError("COMMERCIAL_INVALID_PLAN_CHANGE","INVALID_STATE");
  }else if((await readEntitlements(tx,organizationId,this.now())).kind!=="PAID")throw commercialError("COMMERCIAL_EXISTING_SUBSCRIPTION_REQUIRES_REVIEW","INVALID_STATE");
  const open=await tx.commercialRequest.findFirst({where:{organizationId,status:{in:OPEN}}});
  if(open?.id!==input.replaceRequestId&&(open||input.replaceRequestId))throw commercialError("COMMERCIAL_CONFLICT");
  if(open){await tx.commercialRequest.update({where:{id:open.id},data:{status:"REPLACED"}});await this.audit(tx,actor,organizationId,open.id,"COMMERCIAL_REQUEST_REPLACED");}
  const request=await tx.commercialRequest.create({data:{organizationId,idempotencyKey:input.idempotencyKey,payloadHash:hash,planSlug:input.planSlug,months:input.months,changeKind:input.changeKind,createdById:actor.currentUser.userId}});
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
   if(request.changeKind==="STANDARD")await this.ensureSamePlan(tx,organizationId,request.planSlug);
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
    if(!price||(request.changeKind!=="UPGRADE"&&input.netAmountCents!==price.mul(100).toNumber())||input.customLimits)throw commercialError("COMMERCIAL_PRICE_MISMATCH","INVALID_STATE");
    const features=plan.features as Record<string,unknown>;
    limits=limitsSchema.parse({maxPublishedProducts:plan.maxActivePassports,maxStoredProducts:plan.maxProducts,maxStorageBytes:plan.maxStorageBytes===null?null:Number(plan.maxStorageBytes),maxPdfAttachments:features.maxPdfAttachments});
   }
   const now=this.now(),issuedAt=parseCommercialLocalDateTime(input.issuedAtLocal),expiresAt=addCalendarDays(issuedAt,30);
   if(issuedAt>now)throw commercialError("COMMERCIAL_OFFER_ISSUANCE_INVALID","INVALID_STATE");
   if(expiresAt<=now)throw commercialError("COMMERCIAL_OFFER_EXPIRED","INVALID_STATE");
   const coverage=await this.latestCoverage(tx,organizationId);
   const effective=await readEntitlements(tx,organizationId,now);
   const base=request.changeKind==="REPLACEMENT"?await this.unresolvedReplacement(tx,organizationId):request.changeKind==="UPGRADE"?await tx.subscriptionPaidPeriod.findFirst({where:{organizationId,id:effective.periodId??"00000000-0000-0000-0000-000000000000"}}):coverage;
   const baseLimits=request.changeKind==="UPGRADE"||(base?.id===effective.periodId&&effective.kind==="PAID")?effective.limits:base?snapshotSchema.parse(base.snapshot).limits:null;
   if(request.changeKind!=="STANDARD"&&request.changeKind!=="REPLACEMENT"){
    if(!base||base.endsAt<=now||!baseLimits)throw commercialError("COMMERCIAL_OFFER_REQUIRES_REPLACEMENT","INVALID_STATE");
    const deltas=Object.keys(limits).map(key=>limits[key as keyof typeof limits]-baseLimits[key as keyof typeof limits]);
    if(request.changeKind==="UPGRADE"?deltas.some(d=>d<0)||!deltas.some(d=>d>0):deltas.some(d=>d>0)||!deltas.some(d=>d<0))throw commercialError("COMMERCIAL_INVALID_PLAN_CHANGE","INVALID_STATE");
   }else if(request.changeKind==="STANDARD"&&baseLimits&&request.planSlug==="custom"&&JSON.stringify(baseLimits)!==JSON.stringify(limits))throw commercialError("COMMERCIAL_PLAN_CHANGE_UNSUPPORTED","INVALID_STATE");
   const upgrade=request.changeKind==="UPGRADE";
   const start=!upgrade&&request.changeKind!=="REPLACEMENT"&&coverage&&coverage.endsAt>now?coverage.endsAt:null;
   const anchor=start&&coverage?anchorSchema.parse(coverage.anchor):null;
   const snapshot:CommercialSnapshot={version:2,changeKind:request.changeKind as "STANDARD"|"UPGRADE"|"DOWNGRADE"|"REPLACEMENT",basePeriodId:request.changeKind!=="STANDARD"?base?.id??null:null,baseLimits:request.changeKind!=="STANDARD"?baseLimits:null,downgradeWarnings:request.changeKind==="DOWNGRADE"?quotaDenials(limits,await readEntitlementUsage(tx,organizationId),{}):[],offerIssuedAt:issuedAt.toISOString(),planSlug:request.planSlug as CommercialSnapshot["planSlug"],months,currency:"EUR",netAmountCents:input.netAmountCents,totalAmountCents:input.totalAmountCents,taxTreatment:input.taxTreatment,termsVersion:input.termsVersion,limits,billingProfile,billingRevision:revision,timezone:"Europe/Zagreb",startPolicy:start?"CONTIGUOUS_RENEWAL":"ON_PAYMENT",scheduledStart:start?.toISOString()??null,scheduledEnd:upgrade?base!.endsAt.toISOString():start?addCalendarMonths(start,months,anchor??undefined).toISOString():null,anchor,publicRetentionMonths:6,privateRetentionMonths:12};
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
   const request=await tx.commercialRequest.findUniqueOrThrow({where:{id:input.requestId},include:{acceptedOffer:true,paidPeriod:true,upgradeReceipt:true}});
   if(request.paidPeriod||request.upgradeReceipt){
    const paid=(request.paidPeriod??request.upgradeReceipt)!;
    if(paid.offerId!==input.offerId||paid.paymentKind!==input.kind||paid.issuer!==input.reference.issuer||paid.referenceYear!==input.reference.year||paid.referenceNumber!==input.reference.number)throw commercialError("COMMERCIAL_CONFLICT");return;
   }
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(input.reference)}, 930148))::text`;
   const duplicate=await tx.subscriptionUpgradeReceipt.findFirst({where:{issuer:input.reference.issuer,referenceYear:input.reference.year,referenceNumber:input.reference.number}})??await tx.subscriptionPaidPeriod.findFirst({where:{issuer:input.reference.issuer,referenceYear:input.reference.year,referenceNumber:input.reference.number}});
   if(duplicate)throw commercialError("COMMERCIAL_CONFLICT");
   const offer=request.acceptedOffer,now=this.now();
   if(request.status!=="ACCEPTED"||!offer||offer.id!==input.offerId)throw commercialError("COMMERCIAL_CONFLICT");
   if(offer.expiresAt<=now)throw commercialError("COMMERCIAL_OFFER_EXPIRED","INVALID_STATE");
   if(request.changeKind==="STANDARD")await this.ensureSamePlan(tx,organizationId,request.planSlug);
   const snapshot=snapshotSchema.parse(offer.snapshot),coverage=await this.latestCoverage(tx,organizationId);
   if(snapshot.version===2&&snapshot.changeKind==="UPGRADE"){
    const effective=await readEntitlements(tx,organizationId,now);
    if(effective.kind!=="PAID"||effective.periodId!==snapshot.basePeriodId||effective.end?.toISOString()!==snapshot.scheduledEnd||JSON.stringify(effective.limits)!==JSON.stringify(snapshot.baseLimits))throw commercialError("COMMERCIAL_OFFER_REQUIRES_REPLACEMENT","INVALID_STATE");
    const sequence=await tx.subscriptionUpgradeReceipt.count({where:{basePeriodId:effective.periodId!}})+1;
    const receipt=await tx.subscriptionUpgradeReceipt.create({data:{sequence,organizationId,requestId:request.id,offerId:offer.id,basePeriodId:effective.periodId!,planSlug:snapshot.planSlug,startsAt:now,endsAt:effective.end!,snapshot,paymentKind:input.kind,issuer:input.reference.issuer,referenceYear:input.reference.year,referenceNumber:input.reference.number,confirmedById:actor.currentUser.userId,confirmedAt:now}});
    await tx.commercialRequest.update({where:{id:request.id},data:{status:"PAID"}});
    await this.audit(tx,actor,organizationId,request.id,"COMMERCIAL_UPGRADE_PAYMENT_CONFIRMED",{offerId:offer.id,upgradeReceiptId:receipt.id,paymentKind:input.kind});
    await readEntitlements(tx,organizationId,now);
    return;
   }
   let start=now,anchor=calendarAnchor(now);
   if(snapshot.startPolicy==="CONTIGUOUS_RENEWAL"){
    if(!coverage||coverage.endsAt<=now||coverage.endsAt.toISOString()!==snapshot.scheduledStart||!snapshot.anchor)throw commercialError("COMMERCIAL_OFFER_REQUIRES_REPLACEMENT","INVALID_STATE");
    start=coverage.endsAt;anchor=snapshot.anchor;
   }else if(snapshot.version===2&&snapshot.changeKind==="REPLACEMENT"){
    const blocked=await this.unresolvedReplacement(tx,organizationId);
    const overlaps=await tx.subscriptionPaidPeriod.count({where:{organizationId,endsAt:{gt:now},NOT:{activation:{status:"BLOCKED_REQUIRES_OPERATOR"}}}});
    if(!blocked||blocked.id!==snapshot.basePeriodId||overlaps)throw commercialError("COMMERCIAL_OFFER_REQUIRES_REPLACEMENT","INVALID_STATE");
   }else if(coverage&&coverage.endsAt>now)throw commercialError("COMMERCIAL_CONFLICT");
   const end=addCalendarMonths(start,snapshot.months,anchor);
   if(snapshot.scheduledEnd&&snapshot.scheduledEnd!==end.toISOString())throw commercialError("COMMERCIAL_CONFLICT");
   const period=await tx.subscriptionPaidPeriod.create({data:{organizationId,requestId:request.id,offerId:offer.id,planSlug:request.planSlug,startsAt:start,endsAt:end,anchor,snapshot,paymentKind:input.kind,issuer:input.reference.issuer,referenceYear:input.reference.year,referenceNumber:input.reference.number,confirmedById:actor.currentUser.userId,confirmedAt:now}});
   const priorActivation=coverage?await tx.subscriptionPaidPeriodActivation.findUnique({where:{periodId:coverage.id}}):null;
   if((snapshot.version===2&&(snapshot.changeKind==="DOWNGRADE"||snapshot.changeKind==="REPLACEMENT"))||priorActivation)await tx.subscriptionPaidPeriodActivation.create({data:{periodId:period.id}});
   await readEntitlements(tx,organizationId,now);
   await tx.commercialRequest.update({where:{id:request.id},data:{status:"PAID"}});
   await this.audit(tx,actor,organizationId,request.id,snapshot.version===2&&snapshot.changeKind==="REPLACEMENT"?"COMMERCIAL_REPLACEMENT_PAYMENT_CONFIRMED":"COMMERCIAL_PAYMENT_CONFIRMED",{offerId:offer.id,periodId:period.id,paymentKind:input.kind});
  });
 }
}
