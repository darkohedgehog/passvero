import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { parseImportFile, mapImportRows, validateImportValues } from "../../src/application/products/import-catalog/parse";
import { CatalogImportError, IMPORT_FIELDS, type ImportOptions, type ImportValues, type ImportBatchState } from "../../src/application/products/import-catalog/contracts";
import { createCatalogImportService, type CatalogImportPersistence } from "../../src/application/products/import-catalog/service";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { csvCell } from "../../src/application/products/export-catalog/csv";
import { createCatalogImportHandler } from "../../src/application/products/import-catalog/http";
const options: ImportOptions = { delimiter: ",", defaultLocale: "hr", mapping: { internal_name: 0, sku: 1, source_locale: 2, gtin: 3, cn_code: 4, cn_nomenclature_year: 5 } };
const values: ImportValues = { internal_name: 'Živić, "stolica"\nred', sku: "000123", source_locale: "hr", gtin: "012345000058", cn_code: "0101 21 00", cn_nomenclature_year: "2026" };
const bytes = (rows: ImportValues[], delimiter = ",") => Buffer.from('\ufeff' + IMPORT_FIELDS.join(delimiter) + '\r\n' + rows.map(r => IMPORT_FIELDS.map(f => csvCell(r[f])).join(delimiter)).join('\r\n'));
const context: AuthenticatedUserContext = { organizationId: randomUUID(), userId: randomUUID(), membershipId: randomUUID(), membershipRole: "EDITOR", membershipStatus: "ACTIVE", permissions: ["PRODUCT_CREATE", "PRODUCT_EDIT"], correlationId: "import-test" };
function harness() {
 let writes = 0;
 const empty: ImportBatchState = { id: randomUUID(), status: "ACTIVE", selected: [], outcomes: [] };
 const persistence: CatalogImportPersistence = { async inspect() { return { existing: null, skus: [], gtins: [], names: [] }; }, async confirm(_c,input) { writes++; return { ...empty, selected: input.rows.map(r=>r.number) }; }, async execute() { writes++; return empty; }, async cancel() { writes++; return empty; } };
 return { persistence, service: createCatalogImportService(persistence, "test-only-secret", () => Date.UTC(2026,8,21)), writes: () => writes };
}
const failure = (code: string) => (error: unknown) => error instanceof CatalogImportError && error.code === code;
test("maintained parser: BOM, delimiters, quotes, multiline, diacritics and string identifiers", () => {
 for (const delimiter of [",", ";"] as const) {
  const parsed = parseImportFile(bytes([values],delimiter),delimiter);
  const row = mapImportRows(parsed,{...options,delimiter},2026).rows[0]!;
  assert.equal(row.values.internal_name,values.internal_name);assert.equal(row.values.sku,"000123");assert.equal(row.values.gtin,"012345000058");assert.equal(row.values.cn_code,"01012100");assert.equal(row.valid,true);
 }
 assert.equal(parseImportFile(Buffer.from('name\nChair'),',').records[0]![0],'Chair');
});
test("structural/encoding/file/row/cell bounds reject instead of truncating", () => {
 for (const bad of [Buffer.from([255]),Buffer.from('a,b\n1'),Buffer.from('a,a\n1,2'),Buffer.from('a\n"unterminated'),Buffer.from('a\n\0'),Buffer.from('a\n'+ 'x'.repeat(4097)),Buffer.alloc(20*1024*1024+1)]) assert.throws(()=>parseImportFile(bad,','),failure('FILE'));
 assert.equal(parseImportFile(Buffer.from('a\n'+'x\n'.repeat(10000)),',').records.length,10000);
 assert.throws(()=>parseImportFile(Buffer.from('a\n'+'x\n'.repeat(10001)),','),failure('FILE'));
});
test("mapping ignores export authority columns; locale default and exact domain validators", () => {
 const file=parseImportFile(Buffer.from('name,product_id,manufacturer_name\nChair,spoof,Guess'),',');
 const mapped=mapImportRows(file,{...options,mapping:{internal_name:0,sku:null,source_locale:null,gtin:null,cn_code:null,cn_nomenclature_year:null}},2026);
 assert.deepEqual(mapped.ignored,['product_id','manufacturer_name']);assert.equal(mapped.rows[0]!.values.source_locale,'hr');
 assert.throws(()=>mapImportRows(file,{...options,mapping:{...options.mapping,internal_name:null}},2026),failure('MAPPING'));
 assert.throws(()=>mapImportRows(file,{...options,mapping:{...options.mapping,sku:0}},2026),failure('MAPPING'));
 for(const change of [{internal_name:''},{internal_name:'x'.repeat(201)},{sku:'x'.repeat(129)},{source_locale:'xx'},{gtin:'1.2345E+11'},{gtin:'012345000059'},{cn_code:'123'},{cn_nomenclature_year:''},{cn_nomenclature_year:'2027'}]) assert.ok(validateImportValues({...values,...change},2026).errors.length);
 const apostrophe=mapImportRows(parseImportFile(bytes([{...values,internal_name:'=1+1'}]),','),options,2026).rows[0]!;
 assert.equal(apostrophe.values.internal_name,"'=1+1");assert.equal(apostrophe.apostrophe,true);
 assert.equal(validateImportValues({...values,internal_name:"'original"},2026).values.internal_name,"'original");
 assert.equal(mapImportRows(parseImportFile(bytes([{...values,sku:'1.23e4'}]),','),options,2026).rows[0]!.numericSku,true);
});
test("all in-file exact trimmed SKU duplicates conflict; case remains distinct, GTIN only warns", () => {
 const rows=mapImportRows(parseImportFile(bytes([{...values,sku:'Abc'},{...values,sku:' Abc '},{...values,sku:'abc'}]),','),options,2026).rows;
 assert.deepEqual(rows.map(r=>r.skuConflict),[true,true,false]);assert.ok(rows.every(r=>r.gtinMatch && r.valid));
});
test("preview is read-only; bounded error details preserve total counts", async()=>{
 const h=harness();const preview=await h.service.preview(bytes(Array.from({length:150},(_,i)=>({...values,sku:String(i),gtin:'bad'}))),options,context);
 assert.equal(h.writes(),0);assert.equal(preview.errorCount,150);assert.equal(preview.invalidCount,150);assert.equal(preview.rows.reduce((n,r)=>n+r.errors.length,0),100);
});
test("confirmation binds file, mapping, actor, membership, tenant; tampered/invalid selection cannot write", async()=>{
 const h=harness();const file=bytes([values]);const preview=await h.service.preview(file,options,context);const confirmation={token:preview.token,selected:[1],acceptGtinMatches:false};
 for(const actor of [{...context,organizationId:randomUUID()},{...context,userId:randomUUID()},{...context,membershipId:randomUUID()}]) await assert.rejects(h.service.confirm(file,options,confirmation,actor),failure('STALE_PREVIEW'));
 await assert.rejects(h.service.confirm(bytes([{...values,sku:'different'}]),options,confirmation,context),failure('STALE_PREVIEW'));
 await assert.rejects(h.service.confirm(file,{...options,defaultLocale:'en'},confirmation,context),failure('STALE_PREVIEW'));
 await assert.rejects(h.service.confirm(file,options,{...confirmation,selected:[1,1]},context),failure('SELECTION'));
 await assert.rejects(h.service.confirm(file,options,{...confirmation,selected:[2]},context),failure('SELECTION'));
 assert.equal(h.writes(),0);await h.service.confirm(file,options,confirmation,context);assert.equal(h.writes(),1);
});
test("existing SKU conflicts block, GTIN requires explicit separate-product acknowledgement",async()=>{
 const h=harness();h.persistence.inspect=async()=>({existing:null,skus:['000123'],gtins:[],names:[]});const file=bytes([values]);let preview=await h.service.preview(file,options,context);
 assert.equal(preview.rows[0]!.skuConflict,true);await assert.rejects(h.service.confirm(file,options,{token:preview.token,selected:[1],acceptGtinMatches:true},context),failure('SELECTION'));
 h.persistence.inspect=async()=>({existing:null,skus:[],gtins:['00012345000058'],names:[values.internal_name.toLowerCase()]});preview=await h.service.preview(file,options,context);assert.ok(preview.rows[0]!.gtinMatch && preview.rows[0]!.similarName);
 await assert.rejects(h.service.confirm(file,options,{token:preview.token,selected:[1],acceptGtinMatches:false},context),failure('SELECTION'));
 await h.service.confirm(file,options,{token:preview.token,selected:[1],acceptGtinMatches:true},context);
});
test("read-only roles and forged execution flags cannot import",async()=>{
 const h=harness();for(const actor of [null,{...context,permissions:['PRODUCT_READ']} as AuthenticatedUserContext,{...context,membershipStatus:'SUSPENDED'} as AuthenticatedUserContext]) await assert.rejects(h.service.preview(bytes([values]),options,actor),failure('FORBIDDEN'));
 await assert.rejects(h.service.execute({id:randomUUID(),rows:[{number:1,values,valid:true}]},context),failure('VALIDATION'));
 await assert.rejects(h.service.execute({id:randomUUID(),rows:Array(26).fill({number:1,values})},context),failure('VALIDATION'));
});
test("HTTP origin/proxy/auth checks precede multipart parsing and mutations",async()=>{
 const h=harness();const handler=createCatalogImportHandler({canonicalOrigin:'https://staging.example',verifyProxy:()=>true,resolveContext:async()=>({status:'RESOLVED',context,presentation:{organizationName:'Test'}}),service:h.service});
 const denied=await handler(new Request('https://staging.example/api/products/import?action=preview',{method:'POST',headers:{origin:'https://evil.example'},body:'bad'}));assert.equal(denied.status,403);assert.equal(h.writes(),0);
 const form=new FormData();form.set('file',new File([bytes([values])],'test.csv'));form.set('options',JSON.stringify(options));
 const preview=await handler(new Request('https://staging.example/api/products/import?action=preview',{method:'POST',headers:{origin:'https://staging.example'},body:form}));assert.equal(preview.status,200);assert.equal(h.writes(),0);assert.equal(preview.headers.get('cache-control'),'private, no-store');
});
