import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { withStagingUiAcceptance } from "../../src/infrastructure/documents/staging-ui-acceptance";
import { createDocumentServices } from "../../src/application/documents/services";
import type { DocumentRecord, DocumentPersistence } from "../../src/application/documents/contracts";
import type { AcceptanceManifest } from "../../src/application/documents/acceptance-cleanup";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const now=1789500000000;
const actor:AuthenticatedUserContext={userId:randomUUID(),organizationId:randomUUID(),membershipId:randomUUID(),membershipRole:"EDITOR",membershipStatus:"ACTIVE",permissions:["PRODUCT_EDIT"],correlationId:randomUUID()};
function fixture(){
 const config={runId:randomUUID(),actorId:actor.userId,organizationId:actor.organizationId,expiresAt:now+60000,key:"a".repeat(64)};
 const events:string[]=[];let row:DocumentRecord;let receipt:AcceptanceManifest|undefined;
 const base:DocumentPersistence={async authorize(){events.push("authorize");},async read(){return row;},async finalize(){events.push("finalize");},async fail(){events.push("fail");},async createPending(_actor,data){events.push("create");row={...data,id:randomUUID(),status:"PENDING_UPLOAD"};return row;}};
 const options={config:async()=>config,now:()=>now,retain:async(manifest:AcceptanceManifest)=>{events.push("receipt");receipt=manifest;}};
 const persistence=withStagingUiAcceptance(base,{async archive(){events.push("archive");}},options);
 const bytes=Buffer.from("%PDF-synthetic");const service=createDocumentServices({persistence,storage:{identity:()=>({provider:"supabase",bucket:"passvero-staging-documents",key:`documents/${randomUUID()}.pdf`}),async put(){events.push("put");},async read(){return bytes;}}});
 const input={filename:`acceptance-${config.runId}-A.pdf`,mimeType:"application/pdf",bytes};
 return {config,events,options,input,service,receipt:()=>receipt,row:()=>row};
}
test("UI fixture upload retains exact sealed creation receipt before private storage and marks only that run",async()=>{
 const f=fixture();await f.service.upload(f.input,actor);assert.deepEqual(f.events,["authorize","create","receipt","put","finalize"]);
 assert.equal(f.row().displayName,`acceptance:${f.config.runId}`);assert.equal(f.receipt()?.entries[0].documentId,f.row().id);
 const other=fixture();await other.service.upload({...other.input,filename:"normal.pdf"},actor);assert.equal(other.receipt(),undefined);
});
test("mismatched actor or expired window cannot mark an upload; failed receipt archives before bytes",async()=>{
 for(const mode of ["actor","org","expiry"]){const f=fixture();if(mode==="actor")f.config.actorId=randomUUID();if(mode==="org")f.config.organizationId=randomUUID();if(mode==="expiry")f.config.expiresAt=now;await assert.rejects(f.service.upload(f.input,actor));assert.deepEqual(f.events,["authorize"]);}
 const f=fixture();f.options.retain=async()=>{throw new Error();};await assert.rejects(f.service.upload(f.input,actor));assert.deepEqual(f.events,["authorize","create","archive"]);
});
