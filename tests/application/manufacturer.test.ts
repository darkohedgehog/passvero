import test from "node:test";
import assert from "node:assert/strict";
import { manufacturerSchema, manufacturerCommandSchema } from "../../src/application/products/manufacturer/contracts";
const valid={name:"Maker",addressLine1:"1 Test Road",addressLine2:null,city:"City",region:null,postalCode:null,countryCode:"HR",publicEmail:null,website:null};
test("minimal structured manufacturer and optional public contacts",()=>{assert.deepEqual(manufacturerSchema.parse(valid),valid);assert.equal(manufacturerSchema.safeParse({...valid,publicEmail:"public@example.invalid",website:"https://example.invalid"}).success,true);});
test("reject unsafe links, billing fields, absent address and invalid country",()=>{
 for(const website of ["javascript:alert(1)","data:text/plain,test","file:///tmp/x","https://user:password@example.invalid"])assert.equal(manufacturerSchema.safeParse({...valid,website}).success,false);
 for(const patch of [{name:" "},{addressLine1:""},{city:""},{countryCode:"hr"},{countryCode:"USA"},{billingEmail:"secret@example.invalid"},{name:"Maker\nextra"}])assert.equal(manufacturerSchema.safeParse({...valid,...patch}).success,false);
});
test("commands reject caller authority and enforce explicit snapshot operation",()=>{
 const command={operation:"CREATE",expectedProductUpdatedAt:new Date().toISOString(),values:valid};assert.equal(manufacturerCommandSchema.safeParse(command).success,true);
 assert.equal(manufacturerCommandSchema.safeParse({...command,organizationId:"00000000-0000-4000-8000-000000000001"}).success,false);
 assert.equal(manufacturerCommandSchema.safeParse({...command,operation:"APPLY"}).success,false);
});
test("all locales have identical manufacturer labels; legal values are not localized", async()=>{
 const {readFile}=await import("node:fs/promises");const keys=[];
 for(const locale of ["hr","en","de","sr","sl","pl"]){const m=JSON.parse(await readFile(`messages/${locale}.json`,"utf8")).Manufacturer;keys.push(Object.keys(m).sort());assert.ok(Object.values(m).every(v=>typeof v==="string"&&v.length>0));}
 for(const k of keys)assert.deepEqual(k,keys[0]);assert.equal(manufacturerSchema.parse({...valid,name:"Čelić GmbH"}).name,"Čelić GmbH");
});
