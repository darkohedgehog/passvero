import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDashboardOverview, type DashboardOverview } from "../../src/application/dashboard/overview";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { DashboardOverviewPanel } from "../../src/components/application/dashboard/dashboard-overview";
import { isDashboardNavActive } from "../../src/components/application/dashboard/dashboard-navigation";
import en from "../../messages/en.json";
import hr from "../../messages/hr.json";
import sr from "../../messages/sr.json";
import sl from "../../messages/sl.json";
import de from "../../messages/de.json";
import pl from "../../messages/pl.json";
const context: AuthenticatedUserContext = { userId:"u",organizationId:"org",membershipId:"m",membershipRole:"VIEWER",membershipStatus:"ACTIVE",permissions:["PRODUCT_READ"],correlationId:"test" };
const empty: DashboardOverview = { organizationId:"org",total:0,draft:0,published:0,archived:0,distribution:{draftOnly:0,publishedOnly:0,publishedWithDraft:0,withoutVersion:0},recent:[] };
test("overview rejects missing permission and inactive membership before persistence", async () => {
  let calls=0;const read=createDashboardOverview({async read(){calls++;return empty;}});
  for(const ctx of [null,{...context,permissions:[]},{...context,membershipStatus:"SUSPENDED" as const}])await assert.rejects(read(ctx));
  assert.equal(calls,0);assert.deepEqual(await read(context),empty);
});
test("whole-tenant scope, overlapping cards, exclusive distribution and rejected cross-tenant output",async()=>{
  const data={...empty,total:4,published:2,draft:2,distribution:{draftOnly:1,publishedOnly:1,publishedWithDraft:1,withoutVersion:1}};
  const read=createDashboardOverview({async read(id){assert.equal(id,"org");return data;}});assert.equal((await read(context)).total,4);
  for(const bad of [{...data,organizationId:"other"},{...data,total:25},{...data,draft:3}])await assert.rejects(createDashboardOverview({async read(){return bad;}})(context));
  await assert.rejects(createDashboardOverview({async read(){throw Error("private database error");}})(context),e=>e instanceof Error && !e.message.includes("private database"));
});
function render(data:DashboardOverview|null,createHref:string|null=null){return renderToStaticMarkup(createElement(DashboardOverviewPanel,{data,labels:en.DashboardOverview,locale:"en",catalogHref:"/dashboard/products",createHref,importHref:null,exportHref:"/dashboard/products#catalog-export"}));}
test("empty catalog differs from failed read; viewer gets no create/import action",()=>{
  const zero=render(empty);assert.match(zero,/Your catalog is empty/);assert.doesNotMatch(zero,/New product|Import CSV/);
  const failed=render(null);assert.match(failed,/role="alert"/);assert.match(failed,/Counts are currently unavailable/);assert.doesNotMatch(failed,/Total products|Your catalog is empty/);
  assert.match(render(empty,"/dashboard/products/new"),/New product/);
});
test("recent product escapes names, uses authenticated thumbnail route, labels overlap and archived status",()=>{
  const html=render({...empty,total:1,published:1,draft:1,archived:1,distribution:{draftOnly:0,publishedOnly:0,publishedWithDraft:1,withoutVersion:0},recent:[{organizationId:"org",id:"product",name:"<script>name</script>",sku:"sku",category:"publishedWithDraft",archived:true,updatedAt:new Date("2026-09-23T10:00:00Z"),imageId:"image"}]});
  assert.match(html,/&lt;script&gt;/);assert.match(html,/\/api\/products\/product\/images\/image/);assert.match(html,/Published with a new draft · Archived/);assert.match(html,/not be added together/);
});
test("navigation stays active on product subroutes and all six label contracts agree",()=>{
  assert.equal(isDashboardNavActive("/dashboard","/dashboard"),true);
  for(const p of ["/dashboard/products","/dashboard/products/new","/dashboard/products/id/edit"]){assert.equal(isDashboardNavActive(p,"/dashboard/products"),true);assert.equal(isDashboardNavActive(p,"/dashboard"),false);}
  assert.equal(isDashboardNavActive("/dashboard/products-other","/dashboard/products"),false);
  for(const m of [hr,sr,sl,de,pl])assert.deepEqual(Object.keys(m.DashboardOverview).sort(),Object.keys(en.DashboardOverview).sort());
});
test("donut exposes textual counts and rounded percentages for mixed, single and empty distributions",()=>{
 const mix=render({...empty,total:3,published:2,draft:1,distribution:{draftOnly:1,publishedOnly:2,publishedWithDraft:0,withoutVersion:0}});
 assert.match(mix,/33%/);assert.match(mix,/67%/);assert.match(mix,/0%/);
 const single=render({...empty,total:2,draft:2,distribution:{draftOnly:2,publishedOnly:0,publishedWithDraft:0,withoutVersion:0}});
 assert.match(single,/100%/);assert.doesNotMatch(render(empty),/NaN|Infinity/);
 assert.equal((mix.match(/stroke-dasharray=/g) ?? []).length,2);
 assert.equal((single.match(/stroke-dasharray=/g) ?? []).length,1);
 assert.equal((render(empty).match(/stroke-dasharray=/g) ?? []).length,0);
});
