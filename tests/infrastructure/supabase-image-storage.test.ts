import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseImageStorage } from "../../src/infrastructure/storage/supabase-image-storage";
import type { ImageAsset } from "../../src/application/products/images/contracts";
const config={url:'https://abcdefghijklmnopqrst.supabase.co',key:'sb_secret_'+ 'x'.repeat(40),bucket:'passvero-staging-documents',environment:'staging'};
const id='00000000-0000-4000-8000-000000000001';
function harness(isPublic=false){const calls:Array<{url:string;init:RequestInit|undefined}>=[];
 const transport:typeof fetch=async(url,init)=>{calls.push({url:String(url),init});return String(url).includes('/bucket/')?Response.json({id:'passvero-staging-images',public:isPublic}):new Response(new Uint8Array([1,2,3]));};
 const storage=new SupabaseImageStorage(config,transport);const asset:ImageAsset={id,organizationId:id,...storage.identity(id,'image/png'),mimeType:'image/png',sizeBytes:3,width:1,height:1,checksumSha256:'a'.repeat(64)};return {storage,asset,calls};}
test('private bucket checked; exact unique key POST without upsert; only authenticated read',async()=>{
 const f=harness();await f.storage.put(f.asset,new Uint8Array([1,2,3]));assert.equal(f.calls.length,2);
 assert.equal(f.calls[1].init?.method,'POST');const headers=new Headers(f.calls[1].init?.headers);assert.equal(headers.get('x-upsert'),'false');assert.equal(headers.get('content-type'),'image/png');
 assert.deepEqual(await f.storage.read(f.asset),new Uint8Array([1,2,3]));assert.match(f.calls.at(-1)!.url,/object\/authenticated\/passvero-staging-images\/images\//);
 await f.storage.remove(f.asset);assert.deepEqual(JSON.parse(String(f.calls.at(-1)!.init?.body)),{prefixes:[f.asset.storageKey]});
});
test('public bucket, foreign bucket and unsafe path cannot be used',async()=>{
 const f=harness(true);await assert.rejects(f.storage.put(f.asset,new Uint8Array([1,2,3])));assert.equal(f.calls.length,1);
 for(const altered of [{storageBucket:'passvero-production-images'},{storageKey:'../other.png'},{storageProvider:'foreign'}]){const g=harness();await assert.rejects(g.storage.read({...g.asset,...altered}));assert.equal(g.calls.length,0);}
});
