import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { PrismaCatalogImportPersistence } from "../../src/infrastructure/persistence/prisma/prisma-import-catalog";
import { createCatalogImportService } from "../../src/application/products/import-catalog/service";
import { CatalogImportError, type ImportOptions, type ImportPreview, type ImportBatchState } from "../../src/application/products/import-catalog/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const config = requireSafeTestDatabaseConfig(process.env);
const pool = new Pool({ connectionString: config.url });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.url }) });
const service = createCatalogImportService(new PrismaCatalogImportPersistence(prisma), "local-proof-only");
const options: ImportOptions = { delimiter: ",", defaultLocale: "hr", mapping: { internal_name: 0, sku: 1, source_locale: 2, gtin: 3, cn_code: 4, cn_nomenclature_year: 5 } };
const payload = (id: string, preview: ImportPreview, numbers: number[]) => ({ id, rows: numbers.map(number => ({ number, values: preview.rows[number-1]!.values })) });
const csv = (lines: string[]) => Buffer.from('internal_name,sku,source_locale,gtin,cn_code,cn_nomenclature_year\r\n'+lines.join('\r\n'));
test.after(async () => { await prisma.$disconnect(); await pool.end(); });

test("real PostgreSQL: 5000 create-only rows, atomic identifiers/audit, concurrent replay, resume, partial failure and cancellation", async () => {
 const org = await prisma.organization.create({data:{displayName:'Import proof'}});
 const user = await prisma.user.create({data:{email:`${randomUUID()}@example.test`}});
 const membership = await prisma.membership.create({data:{organizationId:org.id,userId:user.id,role:'EDITOR'}});
 const context: AuthenticatedUserContext = {organizationId:org.id,userId:user.id,membershipId:membership.id,membershipRole:'EDITOR',membershipStatus:'ACTIVE',permissions:['PRODUCT_CREATE','PRODUCT_EDIT'],correlationId:randomUUID()};
 const other = await prisma.organization.create({data:{displayName:'Other import tenant'}});
 const otherMembership = await prisma.membership.create({data:{organizationId:other.id,userId:user.id,role:'EDITOR'}});
 const otherContext={...context,organizationId:other.id,membershipId:otherMembership.id};
 const file=csv(Array.from({length:5000},(_,i)=>`Import Živić ${i},${String(i).padStart(8,'0')},hr,${i===0?'012345000058':''},${i===0?'01012100':''},${i===0?'2026':''}`));
 const rssBefore=process.memoryUsage().rss;const started=performance.now();
 const preview=await service.preview(file,options,context);assert.equal(preview.rows.length,5000);assert.equal(preview.invalidCount,0);
 assert.equal(await prisma.product.count({where:{organizationId:org.id}}),0);assert.equal(await prisma.catalogImportBatch.count(),0);
 const confirmation={token:preview.token,selected:preview.rows.map(r=>r.number),acceptGtinMatches:false};
 const confirmed=await Promise.all([service.confirm(file,options,confirmation,context),service.confirm(file,options,confirmation,context)]);
 assert.equal(confirmed[0]!.id,confirmed[1]!.id);assert.equal(await prisma.catalogImportBatch.count(),1);
 let batch: ImportBatchState=confirmed[0]!;const first=payload(batch.id,preview,Array.from({length:25},(_,i)=>i+1));
 await Promise.all([service.execute(first,context),service.execute(first,context)]);
 assert.equal(await prisma.product.count({where:{organizationId:org.id}}),25);
 // Lost response: re-deliver the exact first batch, with the same outcome IDs.
 batch=await service.execute(first,context);assert.equal(batch.outcomes.filter(r=>r.status==='SUCCEEDED').length,25);
 const resumed=await service.preview(file,options,context);assert.equal(resumed.invalidCount,0);assert.equal(resumed.existing?.id,batch.id);
 assert.equal((await service.confirm(file,options,{...confirmation,token:resumed.token},context)).id,batch.id);
 await assert.rejects(service.execute(first,otherContext),(e:unknown)=>e instanceof CatalogImportError&&e.code==='NOT_FOUND');
 await assert.rejects(service.execute({...first,rows:[{number:1,values:{...preview.rows[0]!.values,internal_name:'Tampered'}}]},context),(e:unknown)=>e instanceof CatalogImportError&&e.code==='VALIDATION');
 let calls=3;
 for(let start=26;start<=5000;start+=25){batch=await service.execute(payload(batch.id,preview,Array.from({length:Math.min(25,5001-start)},(_,i)=>start+i)),context);calls++;}
 assert.equal(batch.status,'COMPLETE');assert.equal(batch.outcomes.filter(r=>r.status==='SUCCEEDED').length,5000);assert.equal(new Set(batch.outcomes.map(r=>r.productId)).size,5000);
 assert.equal(await prisma.product.count({where:{organizationId:org.id,lifecycleStatus:'ACTIVE',currentPublishedVersionId:null}}),5000);
 assert.equal(await prisma.productVersion.count({where:{organizationId:org.id,status:'DRAFT'}}),5000);
 assert.equal(await prisma.productTranslation.count({where:{productVersion:{organizationId:org.id}}}),5000);
 assert.equal(await prisma.auditLog.count({where:{organizationId:org.id,action:'PRODUCT_CREATED'}}),5000);
 const firstProduct=await prisma.product.findUniqueOrThrow({where:{id:batch.outcomes[0]!.productId!},include:{currentDraftVersion:{include:{identifiers:true,translations:true}}}});
 assert.equal(firstProduct.sku,'00000000');assert.equal(firstProduct.currentDraftVersion!.translations[0]!.productName,'Import Živić 0');
 assert.deepEqual(firstProduct.currentDraftVersion!.identifiers.map(i=>[i.type,i.value]).sort(),[['CN','01012100'],['GTIN','012345000058']]);
 assert.equal(await prisma.auditLog.count({where:{entityId:firstProduct.id,action:'PRODUCT_UPDATED'}}),2);
 const durationMs=performance.now()-started;const rssAfter=process.memoryUsage().rss;
 // Reusing the exact file after completion never creates a second import.
 const finished=await service.preview(file,options,context);assert.equal(finished.existing?.status,'COMPLETE');assert.equal(finished.invalidCount,0);
 await service.confirm(file,options,{...confirmation,token:finished.token},context);await service.execute(first,context);assert.equal(await prisma.product.count({where:{organizationId:org.id}}),5000);
 // Matches are tenant-scoped; no global GTIN uniqueness or implicit update.
 const matching=csv(['Same SKU,00000000,hr,00012345000058,,']);
 const same=await service.preview(matching,options,context);assert.ok(same.rows[0]!.skuConflict&&same.rows[0]!.gtinMatch);
 const foreign=await service.preview(matching,options,otherContext);assert.equal(foreign.rows[0]!.skuConflict,false);assert.equal(foreign.rows[0]!.gtinMatch,false);
 // Failure AFTER product/translation/audit creation must roll the entire row back.
 await pool.query(`CREATE FUNCTION fail_import_identifier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.value='4006381333931' THEN RAISE EXCEPTION 'local proof injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER import_failure BEFORE INSERT ON "ProductIdentifier" FOR EACH ROW EXECUTE FUNCTION fail_import_identifier()`);
 const partialFile=csv(['Atomic failure,FAIL-ROW,hr,4006381333931,,','Atomic success,OK-ROW,hr,,,','Cancelled row,CANCEL-ROW,hr,,,']);
 const partialPreview=await service.preview(partialFile,options,context);const partial=await service.confirm(partialFile,options,{token:partialPreview.token,selected:[1,2,3],acceptGtinMatches:false},context);
 const result=await service.execute(payload(partial.id,partialPreview,[1,2]),context);assert.deepEqual(result.outcomes.map(r=>r.status),['FAILED','SUCCEEDED','PENDING']);
 assert.equal(await prisma.product.count({where:{organizationId:org.id,sku:'FAIL-ROW'}}),0);assert.equal(await prisma.productVersion.count({where:{organizationId:org.id,product:{sku:'FAIL-ROW'}}}),0);
 assert.equal(await prisma.auditLog.count({where:{organizationId:org.id,action:'PRODUCT_CREATED'}}),5001);
 await service.cancel(partial.id,context);const cancelled=await service.execute(payload(partial.id,partialPreview,[3]),context);assert.equal(cancelled.status,'CANCELLED');assert.equal(await prisma.product.count({where:{organizationId:org.id,sku:'CANCEL-ROW'}}),0);
 await pool.query('DROP TRIGGER import_failure ON "ProductIdentifier"; DROP FUNCTION fail_import_identifier()');
 // Reauthorization is based on current database membership, not a stale client context.
 const authFile=csv(['Before revoke,AUTH-1,hr,,,','After revoke,AUTH-2,hr,,,']);const authPreview=await service.preview(authFile,options,context);const authBatch=await service.confirm(authFile,options,{token:authPreview.token,selected:[1,2],acceptGtinMatches:false},context);
 await service.execute(payload(authBatch.id,authPreview,[1]),context);await prisma.membership.update({where:{id:membership.id},data:{status:'SUSPENDED'}});
 await assert.rejects(service.execute(payload(authBatch.id,authPreview,[2]),context),(e:unknown)=>e instanceof CatalogImportError&&e.code==='FORBIDDEN');assert.equal(await prisma.product.count({where:{sku:'AUTH-2'}}),0);assert.equal(await prisma.catalogImportRow.count({where:{batchId:authBatch.id,status:'SUCCEEDED'}}),1);
 const report={created:5000,batchSize:25,batchCalls:calls,durationMs,rssBefore,rssAfter,previewProductWrites:0,rowAtomicity:'PASS',audit:'PASS',concurrentReplay:'PASS',resume:'PASS',tenantIsolation:'PASS',partialCancellation:'PASS',authorizationRevocation:'PASS',rawCsvPersisted:false,productionChanges:'NONE',limitation:'Single disposable local run; not a live load test or production SLA.'};
 if(process.env.IMPORT_PROOF_OUTPUT)writeFileSync(process.env.IMPORT_PROOF_OUTPUT,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
});
