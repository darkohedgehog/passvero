import assert from "node:assert/strict";
import test from "node:test";
import { createTranslationManagementServices } from "../../src/application/products/translation-management/service";
import { emptyTranslation } from "../../src/application/products/translation-management/content";
import type { TranslationCommand, TranslationState, TranslationDependencies } from "../../src/application/products/translation-management/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
const id = (n: number) => `${n.toString().padStart(8,'0')}-1111-4111-8111-111111111111`;
const at = new Date("2026-09-11T10:00:00.000Z");
const context: AuthenticatedUserContext = { userId: id(1), organizationId: id(2), membershipId: id(3), membershipRole: "ADMIN", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT", "PRODUCT_READ"], correlationId: "test" };
function fixture() {
  const state: TranslationState = { productId: id(4), organizationId: id(2), lifecycleStatus: "ACTIVE", currentDraftVersionId: id(5), currentPublishedVersionId: null, updatedAt: at,
    published: null, draft: { productVersionId: id(5), productId: id(4), organizationId: id(2), status: "DRAFT", sourceLocale: "hr", updatedAt: at, translations: [{ ...emptyTranslation(), id: id(6), productVersionId: id(5), locale: "hr", productName: "Stolica", updatedAt: at }] } };
  const calls: string[] = [];
  const deps: TranslationDependencies<null> = { transactionRunner: { run: work => work(null) }, persistence: {
    readEligibility: async () => ({ organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "ADMIN" }),
    readState: async () => state, touch: async () => { calls.push("touch"); return true; },
    add: async () => { calls.push("add"); }, edit: async () => { calls.push("edit"); return true; }, remove: async () => { calls.push("remove"); return true; }, audit: async () => { calls.push("audit"); },
  } };
  const command: TranslationCommand = { operation: "ADD", productId: id(4), locale: "en", expectedDraftVersionId: id(5), expectedProductUpdatedAt: at.toISOString(), expectedDraftUpdatedAt: at.toISOString() };
  return { state, calls, deps, command, service: createTranslationManagementServices(deps) };
}
const code = (expected: string) => (e: unknown) => e instanceof ApplicationError && e.code === expected;
test("ADMIN adds one secondary locale with one canonical audit", async () => { const f=fixture(); assert.deepEqual(await f.service.mutate(f.command,context),{status:"ADDED"}); assert.deepEqual(f.calls,["touch","add","audit"]); });
for (const locale of ["en","de","sr","sl","pl"]) test(`supports secondary ${locale}`, async () => { const f=fixture(); await f.service.mutate({...f.command,locale},context); assert.equal(f.calls.filter(x=>x==="add").length,1); });
test("duplicate source add is safely rejected without writes", async () => { const f=fixture(); await assert.rejects(f.service.mutate({...f.command,locale:"hr"},context),code("TRANSLATION_CONFLICT")); assert.deepEqual(f.calls,[]); });
test("source translation cannot be deleted", async () => { const f=fixture(); await assert.rejects(f.service.mutate({...f.command,operation:"REMOVE",locale:"hr",translationId:id(6),expectedTranslationUpdatedAt:at.toISOString()},context),code("TRANSLATION_SOURCE_PROTECTED")); assert.deepEqual(f.calls,[]); });
test("source name remains owned by base editor", async () => { const f=fixture(); await assert.rejects(f.service.mutate({...f.command,operation:"EDIT",locale:"hr",translationId:id(6),expectedTranslationUpdatedAt:at.toISOString(),content:{...emptyTranslation(),productName:"New"}},context),code("TRANSLATION_SOURCE_PROTECTED")); assert.deepEqual(f.calls,[]); });
test("VIEWER cannot mutate and has read access", async () => { const f=fixture(); const viewer:AuthenticatedUserContext={...context,membershipRole:"VIEWER" as const,permissions:["PRODUCT_READ"]}; await assert.rejects(f.service.mutate(f.command,viewer),code("TRANSLATION_FORBIDDEN")); assert.deepEqual(f.calls,[]); assert.equal((await f.service.get(id(4),viewer)).productId,id(4)); });
test("stale Product, draft and wrong tenant produce no mutation", async () => { for (const patch of [{expectedProductUpdatedAt:"2026-09-10T10:00:00.000Z"},{expectedDraftUpdatedAt:"2026-09-10T10:00:00.000Z"},{expectedDraftVersionId:id(8)}]) { const f=fixture(); await assert.rejects(f.service.mutate({...f.command,...patch},context),code("TRANSLATION_STALE_WRITE")); assert.deepEqual(f.calls,[]); } const f=fixture(); await assert.rejects(f.service.mutate(f.command,{...context,organizationId:id(9)})); assert.deepEqual(f.calls,[]); });
test("published-only state cannot be changed", async () => { const f=fixture(); f.deps.persistence.readState=async()=>({...f.state,currentDraftVersionId:null,draft:null}); await assert.rejects(f.service.mutate(f.command,context),code("TRANSLATION_NOT_EDITABLE")); assert.deepEqual(f.calls,[]); });
test("unknown persistence errors are never exposed", async () => { const f=fixture(); f.deps.persistence.add=async()=>{throw new Error("private SQL details");}; await assert.rejects(f.service.mutate(f.command,context),e=> e instanceof ApplicationError && e.code === "TRANSLATION_OPERATIONAL_FAILURE" && !e.message.includes("private")); });

test("EDITOR and OWNER retain PRODUCT_EDIT; source optional content is editable without renaming",async()=>{
 for(const role of ["EDITOR","OWNER"] as const){const f=fixture();f.deps.persistence.readEligibility=async()=>({organizationStatus:"ACTIVE",membershipStatus:"ACTIVE",membershipRole:role});
 await f.service.mutate({...f.command,operation:"EDIT",locale:"hr",translationId:id(6),expectedTranslationUpdatedAt:at.toISOString(),content:{...emptyTranslation(),productName:"Stolica",warrantyInformation:"Two years",publicNotes:"Source note"}},{...context,membershipRole:role});assert.deepEqual(f.calls,["touch","edit","audit"]);}
});
test("no-op edits produce no timestamp or audit mutation after current evidence validation",async()=>{
 const f=fixture();assert.deepEqual(await f.service.mutate({...f.command,operation:"EDIT",locale:"hr",translationId:id(6),expectedTranslationUpdatedAt:at.toISOString(),content:{...emptyTranslation(),productName:"Stolica"}},context),{status:"NO_CHANGE"});assert.deepEqual(f.calls,[]);
});
