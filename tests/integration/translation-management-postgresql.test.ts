import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ApplicationError } from "../../src/application/errors/application-error";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { createTranslationManagementServices } from "../../src/application/products/translation-management/service";
import { emptyTranslation } from "../../src/application/products/translation-management/content";
import type { TranslationCommand } from "../../src/application/products/translation-management/contracts";
import { createPrismaTranslationManagementDependencies } from "../../src/infrastructure/persistence/prisma/prisma-translation-management";
import { createPublishProductService } from "../../src/application/products/publish-product/publish-product";
import { createPrismaPublishProductDependencies } from "../../src/infrastructure/persistence/prisma/prisma-publish-product-composition";
import { createDraftFromPublishedService } from "../../src/application/products/create-draft-from-published/service";
import { createPrismaCreateDraftFromPublishedDependencies } from "../../src/infrastructure/persistence/prisma/prisma-create-draft-from-published";
import { createGetPublicDppService } from "../../src/application/public-dpp/get-public-dpp";
import { PrismaPublicDppPersistence } from "../../src/infrastructure/persistence/prisma/prisma-public-dpp";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
const prisma=createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
test.after(()=>prisma.$disconnect());
const services=createTranslationManagementServices(createPrismaTranslationManagementDependencies(prisma));
const publish=createPublishProductService({...createPrismaPublishProductDependencies(prisma),canonicalOrigin:"https://passvero.example",now:()=>new Date(),generateQrCode:()=>randomUUID().toUpperCase()});
const clone=createDraftFromPublishedService(createPrismaCreateDraftFromPublishedDependencies(prisma));
const publicDpp=createGetPublicDppService({persistence:new PrismaPublicDppPersistence(prisma)});
const safe=(e:unknown)=>e instanceof ApplicationError;
async function seed() {
 const user=await prisma.user.create({data:{email:`${randomUUID()}@test.invalid`}});
 const org=await prisma.organization.create({data:{displayName:"Translation proof"}});
 const membership=await prisma.membership.create({data:{userId:user.id,organizationId:org.id,role:"ADMIN",status:"ACTIVE",joinedAt:new Date()}});
 const context:AuthenticatedUserContext={userId:user.id,organizationId:org.id,membershipId:membership.id,membershipRole:"ADMIN",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ","PRODUCT_EDIT","PRODUCT_PUBLISH"],correlationId:randomUUID()};
 const product=await prisma.product.create({data:{organizationId:org.id,internalName:"Stolica",publicCode:randomUUID().replaceAll("-","").slice(0,22)}});
 const draft=await prisma.productVersion.create({data:{productId:product.id,organizationId:org.id,sourceLocale:"hr",createdById:user.id,translations:{create:{locale:"hr",productName:"Stolica",description:"Izvorni opis"}}}});
 await prisma.product.update({where:{id:product.id},data:{currentDraftVersionId:draft.id}});
 return {context,productId:product.id,publicCode:product.publicCode};
}
type Fixture=Awaited<ReturnType<typeof seed>>;
async function evidence(f:Fixture) {
 const p=await prisma.product.findUniqueOrThrow({where:{id:f.productId},include:{currentDraftVersion:true}});
 assert.ok(p.currentDraftVersion);
 return {productId:p.id,expectedDraftVersionId:p.currentDraftVersion.id,expectedProductUpdatedAt:p.updatedAt.toISOString(),expectedDraftUpdatedAt:p.currentDraftVersion.updatedAt.toISOString()};
}
async function target(f:Fixture,locale:string) {
 const e=await evidence(f);const t=await prisma.productTranslation.findUniqueOrThrow({where:{productVersionId_locale:{productVersionId:e.expectedDraftVersionId,locale}}});
 return {...e,locale,translationId:t.id,expectedTranslationUpdatedAt:t.updatedAt.toISOString()};
}
async function snapshot(f:Fixture) {
 return {product:await prisma.product.findUniqueOrThrow({where:{id:f.productId},include:{versions:{orderBy:{id:"asc"},include:{translations:{orderBy:{locale:"asc"}}}},passport:{include:{qrCode:true}}}}),audits:await prisma.auditLog.findMany({where:{entityId:f.productId},orderBy:{id:"asc"}})};
}
async function add(f:Fixture,locale:string) {return services.mutate({...await evidence(f),locale,operation:"ADD"},f.context);}
async function edit(f:Fixture,locale:string,productName:string) {return services.mutate({...await target(f,locale),operation:"EDIT",content:{...emptyTranslation(),productName,description:`${locale} edited`}},f.context);}
async function publication(f:Fixture) {const p=await prisma.product.findUniqueOrThrow({where:{id:f.productId}});return publish({...await evidence(f),expectedCurrentPublishedVersionId:p.currentPublishedVersionId},f.context);}

test("add EN DE and all six supported locales; empty rows block publication with zero writes",async()=>{
 const f=await seed(); const before=await snapshot(f); const source=before.product.versions[0].translations[0];
 for(const locale of ["en","de","sr","sl","pl"]) await add(f,locale);
 const state=await snapshot(f);const rows=state.product.versions[0].translations;
 assert.equal(rows.length,6);assert.equal(state.product.versions.length,1);
 assert.deepEqual(rows.find(t=>t.locale==="hr"),source);
 for(const row of rows.filter(t=>t.locale!=="hr")) {assert.equal(row.productName,""); for(const key of Object.keys(emptyTranslation()).filter(k=>k!=="productName")) assert.equal(row[key as keyof typeof row],null);}
 assert.equal(state.audits.length,5); assert.deepEqual(state.audits.map(a=>a.metadata).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),["de","en","pl","sl","sr"].map(locale=>({operation:"TRANSLATION_ADD",locale})));
 await assert.rejects(publication(f),e=>e instanceof ApplicationError && e.code==="PUBLISH_PRODUCT_NOT_READY_TRANSLATIONS");
 assert.deepEqual(await snapshot(f),state);
 await assert.rejects(add(f,"en"),safe);assert.deepEqual(await snapshot(f),state);
 assert.equal(state.product.internalName,"Stolica");assert.equal(state.product.publicCode,before.product.publicCode);assert.equal(state.product.versions[0].sourceLocale,"hr");
});
test("concurrent add same locale creates exactly one row and one audit",async()=>{
 const f=await seed();const command:TranslationCommand={...await evidence(f),operation:"ADD",locale:"en"};
 const results=await Promise.allSettled([services.mutate(command,f.context),services.mutate(command,f.context)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1); const loser=results.find(r=>r.status==="rejected");assert.ok(loser?.status==="rejected" && loser.reason instanceof ApplicationError && ["TRANSLATION_STALE_WRITE","TRANSLATION_CONFLICT"].includes(loser.reason.code));
 const state=await snapshot(f);assert.equal(state.product.versions[0].translations.filter(t=>t.locale==="en").length,1);assert.equal(state.audits.length,1);
});
test("edit EN only, simultaneous edit has one winner, remove EN; source protection and exact ownership",async()=>{
 const f=await seed();await add(f,"en"); const before=await snapshot(f);const hr=before.product.versions[0].translations.find(t=>t.locale==="hr");
 const command:TranslationCommand={...await target(f,"en"),operation:"EDIT",content:{...emptyTranslation(),productName:"Chair"}};
 const results=await Promise.allSettled([services.mutate(command,f.context),services.mutate({...command,content:{...command.content,productName:"Seat"}},f.context)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 const current=await snapshot(f);assert.deepEqual(current.product.versions[0].translations.find(t=>t.locale==="hr"),hr);
 for(const forged of [{...await target(f,"hr"),operation:"REMOVE" as const},{...await target(f,"en"),operation:"REMOVE" as const,translationId:randomUUID()},{...await target(f,"en"),operation:"REMOVE" as const,expectedDraftVersionId:randomUUID()}]) await assert.rejects(services.mutate(forged,f.context),safe);
 await assert.rejects(edit(f,"hr","Renamed"),e=>e instanceof ApplicationError && e.code==="TRANSLATION_SOURCE_PROTECTED");
 assert.deepEqual(await snapshot(f),current);
 await services.mutate({...await target(f,"en"),operation:"REMOVE"},f.context);
 const final=await snapshot(f);assert.deepEqual(final.product.versions[0].translations,[hr]);assert.equal(final.audits.length,3);
});
test("wrong tenant, Viewer and revoked edit permission cannot write",async()=>{
 const f=await seed();const other=await seed();const before=await snapshot(f);const command:TranslationCommand={...await evidence(f),operation:"ADD",locale:"en"};
 await assert.rejects(services.mutate(command,other.context),e=>e instanceof ApplicationError && e.category==="NOT_FOUND");
 await assert.rejects(services.mutate(command,{...f.context,membershipRole:"VIEWER",permissions:["PRODUCT_READ"]}),safe);
 await prisma.membership.update({where:{id:f.context.membershipId},data:{role:"VIEWER"}});
 await assert.rejects(services.mutate(command,f.context),safe);
 const read=await services.get(f.productId,{...f.context,membershipRole:"VIEWER",permissions:["PRODUCT_READ"]});assert.equal(read.draft?.translations.length,1);
 assert.deepEqual(await snapshot(f),before);
});
for(const operation of ["ADD","EDIT","REMOVE"] as const) test(`${operation} rollback includes child, timestamps and audit on injected post-audit failure`,async()=>{
 const f=await seed();if(operation!=="ADD")await add(f,"en");const before=await snapshot(f);
 const deps=createPrismaTranslationManagementDependencies(prisma);const original=deps.persistence.audit.bind(deps.persistence);
 deps.persistence.audit=async(tx,input)=>{await original(tx,input);throw new Error("Injected private failure");};
 const command:TranslationCommand=operation==="ADD"?{...await evidence(f),operation,locale:"en"}:operation==="EDIT"?{...await target(f,"en"),operation,content:{...emptyTranslation(),productName:"Chair"}}:{...await target(f,"en"),operation};
 await assert.rejects(createTranslationManagementServices(deps).mutate(command,f.context),e=>e instanceof ApplicationError && e.code==="TRANSLATION_OPERATIONAL_FAILURE");
 assert.deepEqual(await snapshot(f),before);
});
test("HR EN publish, clone all translations, private edit/add/remove, republication, historical immutability and stable QR",async()=>{
 const f=await seed();await add(f,"en");await edit(f,"en","Chair");await publication(f);
 const passport=await prisma.passport.findUniqueOrThrow({where:{productId:f.productId}});
 await prisma.qRCode.update({where:{passportId:passport.id},data:{status:"ACTIVE",activatedAt:new Date()}});
 const before=await snapshot(f); const publicBefore=await publicDpp({publicCode:f.publicCode,requestedLocale:"en",acceptLanguage:null});assert.equal(publicBefore.kind,"PUBLIC");
 const original=before.product.versions[0];
 const readonly=await services.get(f.productId,f.context);assert.equal(readonly.draft,null);assert.equal(readonly.published?.translations.length,2);
 await assert.rejects(services.mutate({operation:"REMOVE",productId:f.productId,locale:"en",expectedDraftVersionId:original.id,expectedProductUpdatedAt:before.product.updatedAt.toISOString(),expectedDraftUpdatedAt:original.updatedAt.toISOString(),translationId:original.translations.find(t=>t.locale==="en")!.id,expectedTranslationUpdatedAt:original.translations.find(t=>t.locale==="en")!.updatedAt.toISOString()},f.context),safe);
 await clone({productId:f.productId,expectedCurrentPublishedVersionId:original.id,expectedProductUpdatedAt:before.product.updatedAt.toISOString()},f.context);
 const copied=await snapshot(f);const draft=copied.product.versions.find(v=>v.id===copied.product.currentDraftVersionId)!;
 assert.equal(draft.translations.length,2);for(const row of draft.translations){const old=original.translations.find(t=>t.locale===row.locale)!;assert.notEqual(row.id,old.id);assert.equal(row.productName,old.productName);assert.equal(row.description,old.description);}
 const privateBefore=await snapshot(f);const oldEn=original.translations.find(t=>t.locale==="en")!;
 await assert.rejects(services.mutate({...await target(f,"en"),translationId:oldEn.id,operation:"REMOVE"},f.context),safe);assert.deepEqual(await snapshot(f),privateBefore);
 await edit(f,"en","Private chair");await add(f,"de");await edit(f,"de","Stuhl");
 assert.deepEqual(await publicDpp({publicCode:f.publicCode,requestedLocale:"en",acceptLanguage:null}),publicBefore);
 const fallback=await publicDpp({publicCode:f.publicCode,requestedLocale:"de",acceptLanguage:null});assert.equal(fallback.kind,"PUBLIC");if(fallback.kind==="PUBLIC"){assert.equal(fallback.dpp.locale,"hr");assert.deepEqual(fallback.dpp.availableLocales,["hr","en"]);}
 let state=await snapshot(f);assert.deepEqual(state.product.versions.find(v=>v.id===original.id),original);assert.deepEqual(state.product.passport,before.product.passport);
 await publication(f);state=await snapshot(f);assert.equal(state.product.currentDraftVersionId,null);assert.equal(state.product.currentPublishedVersionId,draft.id);assert.equal(state.product.versions.find(v=>v.id===original.id)?.status,"SUPERSEDED");assert.deepEqual(state.product.versions.find(v=>v.id===original.id)?.translations,original.translations);
 assert.equal(state.product.publicCode,before.product.publicCode);assert.equal(state.product.passport?.id,before.product.passport?.id);assert.deepEqual(state.product.passport?.qrCode,before.product.passport?.qrCode);
 const after=await publicDpp({publicCode:f.publicCode,requestedLocale:"de",acceptLanguage:null});assert.equal(after.kind,"PUBLIC");if(after.kind==="PUBLIC"){assert.equal(after.dpp.content.productName,"Stuhl");assert.deepEqual(after.dpp.availableLocales,["hr","en","de"]);assert.equal(after.dpp.version.number,2);}
 const stale={...await targetFromPublished(f,draft.id),operation:"REMOVE" as const};await assert.rejects(services.mutate(stale,f.context),safe);assert.deepEqual(await snapshot(f),state);
});
async function targetFromPublished(f:Fixture,versionId:string){const state=await snapshot(f);const row=state.product.versions.find(v=>v.id===versionId)!.translations.find(t=>t.locale==="en")!;return{productId:f.productId,locale:"en",expectedDraftVersionId:versionId,expectedProductUpdatedAt:state.product.updatedAt.toISOString(),expectedDraftUpdatedAt:state.product.versions.find(v=>v.id===versionId)!.updatedAt.toISOString(),translationId:row.id,expectedTranslationUpdatedAt:row.updatedAt.toISOString()};}

test("deleting a copied secondary translation remains private until republication",async()=>{
 const f=await seed();await add(f,"en");await edit(f,"en","Chair");await publication(f);
 const before=await snapshot(f);const publishedId=before.product.currentPublishedVersionId!;
 const publicBefore=await publicDpp({publicCode:f.publicCode,requestedLocale:"en",acceptLanguage:null});
 await clone({productId:f.productId,expectedCurrentPublishedVersionId:publishedId,expectedProductUpdatedAt:before.product.updatedAt.toISOString()},f.context);
 await services.mutate({...await target(f,"en"),operation:"REMOVE"},f.context);
 assert.deepEqual(await publicDpp({publicCode:f.publicCode,requestedLocale:"en",acceptLanguage:null}),publicBefore);
 const privateState=await snapshot(f);assert.deepEqual(privateState.product.passport,before.product.passport);assert.deepEqual(privateState.product.versions.find(v=>v.id===publishedId)?.translations,before.product.versions[0].translations);
 await publication(f);const after=await publicDpp({publicCode:f.publicCode,requestedLocale:"en",acceptLanguage:null});
 assert.equal(after.kind,"PUBLIC");if(after.kind==="PUBLIC"){assert.equal(after.dpp.locale,"hr");assert.deepEqual(after.dpp.availableLocales,["hr"]);}
});
test("database uniqueness independently prevents a duplicate version locale",async()=>{
 const f=await seed();const e=await evidence(f);const before=await snapshot(f);
 await assert.rejects(prisma.productTranslation.create({data:{productVersionId:e.expectedDraftVersionId,locale:"hr",productName:"Duplicate"}}),error=>typeof error==="object" && error!==null && "code" in error && error.code==="P2002");
 assert.deepEqual(await snapshot(f),before);
});
