import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(p,"utf8");
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
test("private asset persistence cannot mutate Product/domain attachments",()=>{
 const source=read("src/infrastructure/persistence/prisma/prisma-document-assets.ts");
 assert.doesNotMatch(source,/\.(product|productVersion|productDocument|productTranslation|passport|qRCode)\.(create|createMany|update|updateMany|delete|deleteMany|upsert)/);
 assert.doesNotMatch(source,/DELETE FROM|UPDATE "Product|INSERT INTO "Product/);
});
test("document runtime owns secret reads behind server-only; no client or public DPP dependency",()=>{
 const runtime=read("src/infrastructure/documents/document-runtime.ts");assert.match(runtime,/import "server-only"/);assert.doesNotMatch(runtime,/NEXT_PUBLIC/);
 for(const file of [...files("src/components"),...files("src/application/public-dpp"),...files("app").filter(f=>f.includes("/p/"))].filter(f=>/\.(tsx?|mjs)$/.test(f))) assert.doesNotMatch(read(file),/DOCUMENT_STORAGE_|supabase-document-storage|document-runtime/);
 const storage=read("src/infrastructure/storage/supabase-document-storage.ts");assert.doesNotMatch(storage,/getPublicUrl|createSignedUrl|object\/public|method:\s*"(?:PUT|DELETE)"/);
});
test("only authenticated upload and GET/HEAD routes; no recovery or anonymous HTTP entry",()=>{
 assert.deepEqual(files("app/api/documents").sort(),["app/api/documents/[documentId]/route.ts","app/api/documents/route.ts"]);
 const http=read("src/application/documents/http.ts");assert.match(http,/resolveContext/);assert.match(http,/authorizeUpload/);assert.doesNotMatch(http,/recoverPending/);
});
