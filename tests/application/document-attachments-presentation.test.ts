import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { NextIntlClientProvider } from "next-intl";
import { ProductDocumentsSection } from "../../src/components/application/products/product-documents-section";
import type { AttachmentDto } from "../../src/application/products/document-attachments/contracts";
import hr from "../../messages/hr.json";
import en from "../../messages/en.json";
import de from "../../messages/de.json";
import sr from "../../messages/sr.json";
import sl from "../../messages/sl.json";
import pl from "../../messages/pl.json";
// React.createElement supplies children in its third argument.
const IntlProvider = NextIntlClientProvider as ComponentType<PropsWithChildren<{ locale: "hr" | "en" | "de" | "sr" | "sl" | "pl"; messages: typeof en; timeZone: string }>>;
const row: AttachmentDto={id:"link",documentId:"asset",category:"MANUAL",locale:"hr",displayLabel:null,description:"<script>literal</script>",isPublic:true,sortOrder:0,updatedAt:"2026-09-01T00:00:00.000Z",availability:"AVAILABLE",downloadUrl:"/api/documents/asset"};
function render(published:boolean,canEdit:boolean,locale: "hr" | "en" | "de" | "sr" | "sl" | "pl"="en",messages=en){
 return renderToStaticMarkup(createElement(AppRouterContext.Provider,{value:{refresh(){}} as never},createElement(IntlProvider,{locale,messages,timeZone:"UTC"},createElement(ProductDocumentsSection,{productId:"product",documents:[row],published,canEdit,evidence:{expectedDraftVersionId:"draft",expectedProductUpdatedAt:row.updatedAt,expectedDraftUpdatedAt:row.updatedAt}}))));
}
test("published and Viewer attachments do not expose an unchecked download or attachment mutation controls",()=>{
 for(const [published,canEdit] of [[true,true],[false,false]]){
 const html=render(published,canEdit);assert.doesNotMatch(html,/href="\/api\/documents\/asset"/);assert.doesNotMatch(html,/>Edit<|>Remove<|<form/);assert.match(html,/Refresh status/);assert.match(html,/Untitled document/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 }
});
test("editor sees bounded draft management with honest public-intent wording",()=>{
 const html=render(false,true);assert.match(html,/Add document/);assert.match(html,/>Edit</);assert.match(html,/>Remove</);assert.match(html,/Public downloads are not enabled yet/);assert.doesNotMatch(html,/storageKey|checksum|supabase/);
});
test("six locales complete and dashboard language leaves HR document locale intact",()=>{
 for(const [locale,messages] of Object.entries({hr,en,de,sr,sl,pl})){
  assert.deepEqual(Object.keys(messages.DocumentScan).sort(),Object.keys(en.DocumentScan).sort());
  assert.deepEqual(Object.keys(messages.DocumentScan.statuses).sort(),["CLEAN","ERROR","INFECTED","PENDING","UNSCANNED"]);
  assert.deepEqual(Object.keys(messages.ProductDocuments).sort(),Object.keys(en.ProductDocuments).sort());
  assert.equal(Object.keys(messages.ProductDocuments.categories).length,4);assert.equal(Object.keys(messages.ProductDocuments.languages).length,6);
  const html=render(false,false,locale as "hr" | "en" | "de" | "sr" | "sl" | "pl",messages);assert.match(html,/HR · PDF/);assert.ok(html.includes(messages.ProductDocuments.untitled));
 }
});
test("new attachment form has explicit unchecked public intent and all labeled inputs",async()=>{
 const {AttachmentForm}=await import("../../src/components/application/products/product-documents-section");
 const html=renderToStaticMarkup(createElement(IntlProvider,{locale:"en",messages:en,timeZone:"UTC"},createElement(AttachmentForm,{productId:"product",evidence:{expectedDraftVersionId:"draft",expectedProductUpdatedAt:row.updatedAt,expectedDraftUpdatedAt:row.updatedAt},row:null,onClose(){},onSuccess(){}})));
 assert.match(html,/name="isPublic"/);assert.doesNotMatch(html,/checked=""/);
 for(const field of ["file","category","displayLabel","locale","description"])assert.match(html,new RegExp(`name="${field}"`));
 assert.match(html,/value="" selected=""/);assert.match(html,/type="file"/);assert.match(html,/accept="application\/pdf,.pdf"/);
 assert.match(html,/min-w-0/);assert.match(html,/<label/);assert.match(html,/Public downloads are not enabled yet/);
});
