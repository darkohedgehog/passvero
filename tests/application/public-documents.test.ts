import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { createPublicDocumentService, type PublicDocumentRow } from "../../src/application/public-dpp/documents";
import { createPublicDocumentHttpHandler } from "../../src/application/public-dpp/document-http";
import { healthFixture } from "../helpers/signature-health-fixture";
const code = "a".repeat(22), id = randomUUID(), now = Date.now(), bytes = Buffer.from("%PDF-1.7 local test");
function fixture() {
  let row: PublicDocumentRow | undefined = { attachmentId: id, versionId: randomUUID(), versionNumber: 1,
    publishedAt: new Date(now).toISOString(), label: 'Manual "<test>"', category: "MANUAL", locale: "hr",
    document: { id: randomUUID(), status: "AVAILABLE", originalFilename: "private-name.pdf", displayName: null,
      sizeBytes: bytes.length, checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      storage: { provider: "fake", bucket: "private", key: "secret-key" }, scan: { status: "CLEAN", attemptId: randomUUID(),
        startedAt: now - 2, scannedAt: now - 1, sha256: createHash("sha256").update(bytes).digest("hex"), policyVersion: 2 } } };
  let afterRead = () => {}; let corrupt = false, healthy = true;
  const service = createPublicDocumentService({ now: () => now,
    persistence: { async read(c, a) { return c === code && (!a || a === id) && row ? [row] : []; } },
    storage: { identity: () => row!.document.storage, async put() { throw new Error(); }, async read() { afterRead(); return corrupt ? Buffer.from("bad") : bytes; } },
    health: { async read() { if (!healthy) throw new Error("secret"); return healthFixture(now); } },
  });
  return { service, get row() { return row!; }, set row(r: PublicDocumentRow) { row = r; },
    remove: () => { row = undefined; }, duringRead: (f: () => void) => { afterRead = f; },
    corrupt: () => { corrupt = true; }, unhealthy: () => { healthy = false; } };
}
test("public DTO is minimal; authorized attachment serves exact bytes, not private filename", async () => {
  const f = fixture(); const items = await f.service.list(code, { number: 1, publishedAt: f.row.publishedAt });
  assert.equal(items.length, 1); assert.deepEqual(Object.keys(items[0]).sort(), ["category","downloadPath","label","locale","sizeBytes"]);
  assert.ok(!JSON.stringify(items).includes("secret-key")); assert.ok(!JSON.stringify(items).includes("private-name"));
  const result = await f.service.download(code,id,false,new AbortController().signal);
  assert.deepEqual(result.bytes, bytes); assert.ok(!result.filename.includes("private-name"));
});
for (const status of ["UNSCANNED","PENDING","INFECTED","ERROR"] as const) test(`${status} omitted and denied`,async()=>{
  const f=fixture(); f.row={...f.row,document:{...f.row.document,scan:{...f.row.document.scan!,status}}};
  assert.deepEqual(await f.service.list(code,{number:1,publishedAt:f.row.publishedAt}),[]);
  await assert.rejects(f.service.download(code,id,false,new AbortController().signal));
});
for (const change of ["old","future","policy","digest","archived","health"] as const) test(`invalid CLEAN ${change} denied`,async()=>{
  const f=fixture();const d=f.row.document;const s={...d.scan!};
  if(change==="old")s.scannedAt=now-7*86400000-1;
  if(change==="future")s.scannedAt=now+1;
  if(change==="policy")s.policyVersion=1;
  if(change==="digest")s.sha256="b".repeat(64);
  if(change==="health")f.unhealthy();
  f.row={...f.row,document:{...d,status:change==="archived"?"ARCHIVED":d.status,scan:s}};
  assert.deepEqual(await f.service.list(code,{number:1,publishedAt:f.row.publishedAt}),[]);
  await assert.rejects(f.service.download(code,id,false,new AbortController().signal));
});
test("wrong code/link, removed link and old publication rejected including change during storage read",async()=>{
  const f=fixture();await assert.rejects(f.service.download("b".repeat(22),id,false,new AbortController().signal));
  await assert.rejects(f.service.download(code,randomUUID(),false,new AbortController().signal));
  assert.deepEqual(await f.service.list(code,{number:2,publishedAt:f.row.publishedAt}),[]);
  f.duringRead(()=>{f.row={...f.row,versionId:randomUUID()};});
  await assert.rejects(f.service.download(code,id,false,new AbortController().signal));
  f.duringRead(f.remove);await assert.rejects(f.service.download(code,id,false,new AbortController().signal));
});
test("integrity failure, concurrent verdict change and object substitution cannot deliver bytes",async()=>{
  const bad=fixture();bad.corrupt();await assert.rejects(bad.service.download(code,id,false,new AbortController().signal));
  for(const type of ["verdict","object"]){const f=fixture();f.duringRead(()=>{f.row={...f.row,document:{...f.row.document,...(type==="verdict"?{status:"ARCHIVED" as const}:{storage:{...f.row.document.storage,key:"other"}})}};});await assert.rejects(f.service.download(code,id,false,new AbortController().signal));}
});
test("HTTP HEAD/range/conditional reauthorize; generic failure and staging gate",async()=>{
  const f=fixture();const handler=createPublicDocumentHttpHandler({service:f.service,enabled:()=>true});
  for(const method of ["GET","HEAD"]){const r=await handler(new Request(`https://staging.passvero.eu/p/${code}/documents/${id}`,{method,headers:{Range:"bytes=0-1","If-None-Match":"*"}}),code,id);assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");assert.equal(r.headers.get("accept-ranges"),"none");assert.equal((await r.arrayBuffer()).byteLength,method==="HEAD"?0:bytes.length);}
  f.remove();const missing=await handler(new Request('https://staging.passvero.eu/p/x'),code,id);assert.equal(missing.status,404);assert.deepEqual(await missing.json(),{status:"NOT_FOUND"});
  const off=createPublicDocumentHttpHandler({service:fixture().service,enabled:()=>false});assert.equal((await off(new Request('https://passvero.eu/p/x'),code,id)).status,404);
});
