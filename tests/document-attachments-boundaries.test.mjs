import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test("attachment transaction has no binary/provider writes and never mutates Document",()=>{
 const persistence=read('src/infrastructure/persistence/prisma/prisma-document-attachments.ts');
 assert.doesNotMatch(persistence,/tx\.document\.(create|update|delete|upsert)|fetch\(|Supabase|storageKey|checksum/);
 assert.match(persistence,/FOR UPDATE/);assert.match(persistence,/FOR SHARE/);
 assert.match(persistence,/productDocument\.deleteMany/);
 assert.match(persistence,/isPrimary: false/);
});
test("public DTO and public persistence remain document-free",()=>{
 for(const p of ['src/application/public-dpp/contracts.ts','src/infrastructure/persistence/prisma/prisma-public-dpp.ts'])assert.doesNotMatch(read(p),/productDocument|documentId|storageKey|checksumSha256/);
});
test("private Product attachments reuse asset endpoint and six locale metadata never follows dashboard locale",()=>{
 const source=read('src/components/application/products/product-documents-section.tsx');
 assert.doesNotMatch(source,/useLocale|sourceLocale|preferredLocale|storageKey|supabase/);
 assert.match(source,/defaultChecked=\{row\?\.isPublic \?\? false\}/);
 const runtime=read('src/infrastructure/products/document-attachments-runtime.ts');assert.match(runtime,/import "server-only"/);
 assert.match(runtime,/resolveAuthenticatedUserContext/);assert.match(runtime,/verifyRuntimeProxy/);
});
