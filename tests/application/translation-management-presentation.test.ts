import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement, type ReactNode, type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ProductTranslationManager, TranslationForm, type TranslationLabels, type TranslationManagerData } from "../../src/components/application/products/product-translation-manager";
import { emptyTranslation, TRANSLATION_TEXT_FIELDS } from "../../src/application/products/translation-management/content";
import { getPublicDppLabels } from "../../src/components/public-dpp/public-dpp-labels";
import en from "../../messages/en.json";
import de from "../../messages/de.json";
import hr from "../../messages/hr.json";
import sr from "../../messages/sr.json";
import sl from "../../messages/sl.json";
import pl from "../../messages/pl.json";
const publicLabels=getPublicDppLabels("en");
const labels:TranslationLabels={...en.ProductTranslations,languages:publicLabels.languageNames,fields:Object.fromEntries(TRANSLATION_TEXT_FIELDS.map(key=>[key,publicLabels[key]])) as TranslationLabels["fields"]};
const row={...emptyTranslation(),productName:"Stolica",description:"Hrvatski opis",id:"row",productVersionId:"draft",locale:"hr",updatedAt:"2026-09-11T10:00:00.000Z"};
const data:TranslationManagerData={productId:"product",sourceLocale:"hr",published:false,canEdit:true,translations:[row],evidence:{expectedDraftVersionId:"draft",expectedProductUpdatedAt:row.updatedAt,expectedDraftUpdatedAt:row.updatedAt}};
function render(value:TranslationManagerData,copy=labels){return renderToStaticMarkup(createElement(AppRouterContext.Provider,{value:{refresh(){}} as never},createElement(ProductTranslationManager,{data:value,labels:copy,baseEditHref:"/dashboard/products/product/edit"})));}
test("six draft locale controls with protected source name and accessible labels",()=>{
 const html=render(data);assert.equal((html.match(/aria-pressed=/g)??[]).length,6);
 assert.match(html,/HR · Hrvatski · Source/);assert.match(html,/readonly=""/i);assert.match(html,/lang="hr"/);assert.match(html,/Hrvatski opis/);
 assert.doesNotMatch(html,/>Delete translation</);assert.match(html,/min-h-11/);assert.match(html,/aria-label="DPP content languages"/);
});
test("published and Viewer read models expose no mutation controls",()=>{
 for(const value of [{...data,published:true},{...data,canEdit:false}]){const html=render(value);assert.doesNotMatch(html,/<form|<textarea|>Save translation<|>Add translation<|>Delete translation</);assert.match(html,/Stolica/);}
 assert.equal((render({...data,published:true}).match(/aria-pressed=/g)??[]).length,1);
});
test("German dashboard copy does not change HR content or selection",()=>{
 const html=render(data,{...labels,...de.ProductTranslations});assert.match(html,/DPP-Inhaltssprachen/);assert.match(html,/Hrvatski opis/);assert.match(html,/HR · Hrvatski · Ausgangssprache/);assert.match(html,/lang="hr"/);
});
test("all six UI locales supply exactly the manager and publication messages",()=>{
 for(const messages of [hr,en,de,sr,sl,pl]){assert.deepEqual(Object.keys(messages.ProductTranslations).sort(),Object.keys(en.ProductTranslations).sort());assert.ok(messages.PublishProduct.translations);}
});

// Exercise the form's actual link callback, without a browser or business runtime.
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
 if (Array.isArray(node)) return node.flatMap(elements);
 if (typeof node !== "object" || node === null || !("props" in node)) return [];
 const element = node as ReactElement<Record<string, unknown>>;
 return [element, ...elements(element.props.children as ReactNode)];
}
for (const [dirty, confirmed, prevented, confirmations] of [
 [false, false, false, 0], [true, true, false, 1], [true, false, true, 1],
] as const) test(`source editor navigation: dirty=${dirty}, discard=${confirmed}`, () => {
 let form: ReactElement | undefined;
 let confirmationCalls = 0;
 let writes = 0;
 const originalFetch = globalThis.fetch;
 globalThis.fetch = async () => { writes++; throw new Error("Unexpected API call"); };
 const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
 Object.defineProperty(globalThis, "window", {configurable:true, value:{confirm:()=>{confirmationCalls++;return confirmed;}}});
 try {
  function Capture() {
   form = TranslationForm({row, source:true, labels, pending:false, dirty,
    baseEditHref:"/dashboard/products/product/edit", onDirty(){}, onSave:async()=>{writes++;}});
   return form;
  }
  renderToStaticMarkup(createElement(Capture));
  assert.ok(form);
  const link = elements(form).find(element=>element.type === "a");
  assert.ok(link);
  const controls = elements(form).filter(element=>element.type === "input" || element.type === "textarea");
  const unsavedDescription = {value:"Unsaved source description"};
  let resets = 0;
  const event = new Event("click", {cancelable:true});
  Object.defineProperty(event,"currentTarget",{value:{closest:()=>({reset(){resets++;unsavedDescription.value="Hrvatski opis";}})}});
  const click = link.props.onClick as ((event: MouseEvent<HTMLAnchorElement>)=>void) | undefined;
  click?.(event as unknown as MouseEvent<HTMLAnchorElement>);
  assert.equal(event.defaultPrevented, prevented);
  assert.equal(confirmationCalls, confirmations);
  assert.equal(writes, 0);
  assert.equal(link.props.href, "/dashboard/products/product/edit");
  // Cancellation must not invoke form reset, replace its controls, or submit it.
  assert.deepEqual(elements(form).filter(element=>element.type === "input" || element.type === "textarea"), controls);
  assert.equal(unsavedDescription.value,"Unsaved source description");
  assert.equal(resets,0);
 } finally {
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis,"window",originalWindow);
  else Reflect.deleteProperty(globalThis,"window");
 }
});
