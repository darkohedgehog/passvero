import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
const read=path=>readFileSync(path,"utf8");
test("operator provisioning has no public route, provider write, credential handling, or business Prisma in the application",()=>{
 const paths=readdirSync("app",{recursive:true}).filter(path=>/\.(ts|tsx)$/.test(path));
 for(const path of paths)assert.doesNotMatch(read(`app/${path}`),/operator-provisioning|provisionControlledCustomer/);
 const application=read("src/application/auth/operator-provisioning.ts")+read("src/application/auth/operator-provisioning-cli.ts");
 assert.doesNotMatch(application,/generated\/prisma|PrismaClient|signUpEmail|AuthIdentity|authProvider/);
 const adapter=read("src/infrastructure/persistence/prisma/prisma-operator-provisioning.ts");
 assert.doesNotMatch(adapter,/authProvider|authIdentity\.|password|\.upsert\(|\.update(?:Many)?\(|\.delete/);
 assert.doesNotMatch(read("scripts/provision-controlled-customer.ts"),/dotenv|writeFile|console\./);
});
test("actual CLI rejects missing arguments with safe stderr and no configuration or database access",()=>{
 const child=spawnSync(process.execPath,["--conditions=react-server","--import","tsx","scripts/provision-controlled-customer.ts"],{env:{PATH:process.env.PATH},encoding:"utf8",timeout:10000});
 assert.equal(child.status,2);assert.equal(child.stdout,"");assert.match(child.stderr,/^INVALID_INPUT:/);assert.doesNotMatch(child.stderr,/Prisma|postgres|capability=|Error:/);
});
