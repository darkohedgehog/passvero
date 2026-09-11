import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseDocumentStorage, parseDocumentStorageConfig } from "../../src/infrastructure/storage/supabase-document-storage";
const config = {url:"https://abcdefghijklmnopqrst.supabase.co",key:"sb_secret_"+"x".repeat(40),bucket:"passvero-staging-documents",environment:"staging"};
test("config requires server credential, HTTPS hosted endpoint, dedicated environment bucket",()=>{
 assert.equal(parseDocumentStorageConfig(config).bucket,config.bucket);
 for(const patch of [{url:"http://localhost"},{key:"anon"},{bucket:"passvero-production-documents"},{url:config.url+"/path"},{environment:"development"}])assert.throws(()=>parseDocumentStorageConfig({...config,...patch}));
});
test("adapter checks bucket private, uploads without overwrite, reads authenticated; no redirects",async()=>{
 const calls:Array<{url:string;init?:RequestInit}>=[];
 const fake:typeof fetch=async(url,init)=>{calls.push({url:String(url),init});if(String(url).includes("/bucket/"))return Response.json({id:config.bucket,public:false});return init?.method==="POST"?Response.json({Key:"ignored"}):new Response("%PDF-1.7");};
 const storage=new SupabaseDocumentStorage(parseDocumentStorageConfig(config),fake);
 const id=storage.identity();assert.notEqual(id.key,storage.identity().key);assert.match(id.key,/^documents\/[0-9a-f-]+\.pdf$/);
 await storage.put(id,Buffer.from("%PDF-1.7"));assert.equal(Buffer.from(await storage.read(id)).toString(),"%PDF-1.7");
 const put=calls.find(c=>c.init?.method==="POST")!;assert.equal(new Headers(put.init?.headers).get("x-upsert"),"false");
 assert.ok(calls.every(c=>c.init?.redirect==="error"));assert.ok(calls.some(c=>c.url.includes("/object/authenticated/")));
});
test("public bucket and foreign storage identity are rejected before object write",async()=>{
 let calls=0;const storage=new SupabaseDocumentStorage(parseDocumentStorageConfig(config),async()=>{calls++;return Response.json({id:config.bucket,public:true});});
 await assert.rejects(storage.put(storage.identity(),Buffer.from("%PDF-")));assert.equal(calls,1);
 await assert.rejects(storage.read({...storage.identity(),bucket:"foreign"}));assert.equal(calls,1);
});
test("provider errors and redirects do not leak diagnostics",async()=>{
 const storage=new SupabaseDocumentStorage(parseDocumentStorageConfig(config),async()=>new Response("SECRET bucket diagnostic",{status:403}));
 await assert.rejects(storage.read(storage.identity()),e=>e instanceof Error&&!e.message.includes("SECRET"));
});
test("same key cannot overwrite an existing object and upload does not retry",async()=>{
 let stored:Uint8Array|undefined;let writes=0;
 const storage=new SupabaseDocumentStorage(parseDocumentStorageConfig(config),async(url,init)=>{
  if(String(url).includes("/bucket/"))return Response.json({id:config.bucket,public:false});
  if(init?.method==="POST"){writes++;if(stored)return new Response("existing asset",{status:400});stored=new Uint8Array(await new Response(init.body).arrayBuffer());return Response.json({});}
  return new Response(new Uint8Array(stored!));
 });
 const identity=storage.identity();await storage.put(identity,Buffer.from("%PDF-original"));await assert.rejects(storage.put(identity,Buffer.from("%PDF-replacement")));assert.equal(writes,2);assert.equal(Buffer.from(await storage.read(identity)).toString(),"%PDF-original");
});
test("oversized provider response is bounded and cancelled",async()=>{
 let cancelled=false;
 const storage=new SupabaseDocumentStorage(parseDocumentStorageConfig(config),async(url)=>String(url).includes("/bucket/")?Response.json({id:config.bucket,public:false}):new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(10*1024*1024+1));},cancel(){cancelled=true;}})));
 await assert.rejects(storage.read(storage.identity()));assert.equal(cancelled,true);
});
