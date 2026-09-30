// Local-only artifact preparation. Requires a successful build report; never builds or deploys.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
const require=createRequire(import.meta.url);
const root=process.cwd();
const [preflightPath,buildReportPath,sourceManifestPath,outArg]=process.argv.slice(2);
if(!outArg)throw new Error('Usage: node scripts/prepare-subscription-staging.mjs preflight.json build-report.json source.sha256 OUTPUT_DIRECTORY');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashFile=async p=>sha(await fs.readFile(p));
const preflight=JSON.parse(await fs.readFile(preflightPath,'utf8'));
const build=JSON.parse(await fs.readFile(buildReportPath,'utf8'));
const source=await fs.readFile(sourceManifestPath);
const operatorHash=preflight.retainedOperatorHash??'caac6bbc4fe5604c23837527c65aff1e35717580d7c079f7002f08406c87eda5';
if(!/^[a-f0-9]{64}$/.test(operatorHash))throw new Error('Operator hash required');
if(preflight.preflight!=='PASS'||preflight.database?.database!=='passvero_acceptance'||preflight.database?.port!=='5433'||preflight.database?.dataDirectory!=='/var/lib/postgresql/16/acceptance')throw new Error('Explicit staging preflight required');
if(build.result!=='PASS'||build.sourceManifestSha256!==sha(source))throw new Error('Successful pinned build report required');
for(const line of source.toString().trim().split('\n')){
 const match=/^([a-f0-9]{64})  (.+)$/.exec(line);
 if(!match||path.isAbsolute(match[2])||match[2].split('/').includes('..')||await hashFile(match[2])!==match[1])throw new Error('Build source drift');
}
const buildId=(await fs.readFile('.next/BUILD_ID','utf8')).trim();
if(build.buildId!==buildId)throw new Error('Build ID mismatch');
let dependencyMode='EXACT_SOURCE_METADATA';
if(await hashFile('package.json')!==preflight.packageHash||await hashFile('package-lock.json')!==preflight.lockHash){
 // The deployed metadata predates two build-bundled libraries. Permit only the
 // byte-pinned historical pair, exact semantic delta and a matching runtime probe.
 const historical='db9bbd49881586a88141759e75bf7be6e968429e';
 const additions={'bwip-js':'4.11.4','csv-parse':'7.0.2'};
 for(const [file,pin] of [['package.json',preflight.packageHash],['package-lock.json',preflight.lockHash]]){
  const bytes=execFileSync('git',['show',`${historical}:${file}`]);
  if(sha(bytes)!==pin)throw new Error('Unrecognized staging metadata');
  const before=JSON.parse(bytes);const current=JSON.parse(await fs.readFile(file,'utf8'));
  const deps=file==='package.json'?current.dependencies:current.packages[''].dependencies;
  for(const [name,version] of Object.entries(additions)){
   if(deps[name]!==version)throw new Error('Bundled library version drift');
   delete deps[name];
   if(file==='package-lock.json'){
    const entry=current.packages[`node_modules/${name}`];
    if(entry?.version!==version||Object.keys(entry.dependencies??{}).length)throw new Error('Bundled library dependency drift');
    delete current.packages[`node_modules/${name}`];
   }
  }
  if(!isDeepStrictEqual(before,current))throw new Error('Unreviewed dependency delta');
 }
 const probe=preflight.runtimeProbe;
 if(probe?.result!=='PASS'||probe.buildId!==preflight.buildId||probe.writes!=='NONE'||!isDeepStrictEqual(probe.absentPackages,Object.keys(additions)))throw new Error('Runtime probe required');
 let traces=0;
 async function checkTraces(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,e.name);
  if(file==='.next/dev'||file==='.next/cache')continue;
  if(e.isDirectory())await checkTraces(file);
  else if(e.name.endsWith('.nft.json')){
   traces++;const trace=JSON.parse(await fs.readFile(file,'utf8'));
   if(trace.files.some(f=>Object.keys(additions).some(n=>f.includes(`/node_modules/${n}/`))))throw new Error('Missing external runtime library');
  }
 }}
 await checkTraces('.next');if(traces===0)throw new Error('Build traces required');
 dependencyMode='VERIFIED_HISTORICAL_METADATA_BUNDLED_ADDITIONS';
}
const expectedEmails=['prodaja@zivic-elektro.com','zivic.darko79@gmail.com'];
const approved={};
for(const email of expectedEmails){const rows=preflight.accounts.filter(a=>a.email===email&&a.verified===true);if(rows.length!==1||!/^[a-f0-9-]{36}$/i.test(rows[0].id))throw new Error('Verified approved identity missing');approved[email]=rows[0].id;}
const migration='20260930120000_manual_commercial_subscriptions';
const entries=(await fs.readdir('prisma/migrations',{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort();
if(entries.at(-1)!==migration)throw new Error('Unexpected migration head');
const prior=[];const migrationFiles={};
for(const name of ['schema.prisma','migrations/migration_lock.toml',...entries.map(e=>`migrations/${e}/migration.sql`)]){const bytes=await fs.readFile(`prisma/${name}`);migrationFiles[name]={sha256:sha(bytes),content:bytes.toString()};}
for(const name of entries.slice(0,-1))prior.push({migration_name:name,checksum:migrationFiles[`migrations/${name}/migration.sql`].sha256,finished:true,rolled_back:false});
if(JSON.stringify(preflight.migrations)!==JSON.stringify(prior))throw new Error('Preflight migration history mismatch');
const out=path.resolve(outArg);await fs.mkdir(out,{recursive:false,mode:0o700});
const write=async(name,data)=>fs.writeFile(path.join(out,name),data,{mode:0o600});
await write('migration-package.json',JSON.stringify({latest:migration,files:migrationFiles},null,2));
await write('preflight.json',JSON.stringify(preflight,null,2));await write('build-report.json',JSON.stringify(build,null,2));await write('source.sha256',source);
for(const name of ['migrate.py','deploy.py','rollback.py','setup.py'])await write(name,await fs.readFile(`codex/evidence/subscription-commercial/${name}`));
const {build:bundle}=await import('esbuild');
const compilerPlugin={name:'embed-prisma-compiler',setup(b){b.onResolve({filter:/^@prisma\/client\/runtime\/query_compiler_fast_bg\.postgresql(?:\.wasm-base64)?\.mjs$/},args=>({path:require.resolve(args.path)}));}};
const bundleOptions={bundle:true,platform:'node',target:'node22',format:'cjs',packages:'external',plugins:[compilerPlugin],define:{'import.meta.url':'__operatorModuleUrl'},banner:{js:'const __operatorModuleUrl = require("node:url").pathToFileURL(__filename).href;'}};
await bundle({...bundleOptions,entryPoints:['scripts/subscription-staging-setup.ts'],outfile:path.join(out,'setup.cjs')});
const compilerProof=`(async()=>{const runtime=await import('@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs');const {wasm}=await import('@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs');new WebAssembly.Module(Buffer.from(wasm,'base64'));if(!Object.keys(runtime).length)throw Error();console.log('COMPILER_LOAD=PASS');})().catch(()=>{process.exitCode=1;});`;
await bundle({...bundleOptions,stdin:{contents:compilerProof,resolveDir:root},outfile:path.join(out,'compiler-proof.cjs')});
const proof=execFileSync(process.execPath,[path.join(out,'compiler-proof.cjs')],{cwd:'/',encoding:'utf8',env:{PATH:process.env.PATH,NODE_PATH:path.join(root,'node_modules')}}).trim();
if(proof!=='COMPILER_LOAD=PASS')throw new Error('Compiler load proof failed');
await write('compiler-proof.json',JSON.stringify({result:'PASS'}));
const files={};
async function collect(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=`${dir}/${e.name}`;if(file==='.next/cache'||file==='.next/dev')continue;if(e.isSymbolicLink())throw new Error('Unexpected artifact symlink');if(e.isDirectory())await collect(file);else if(e.isFile())files[file]=await hashFile(file);else throw new Error('Unexpected artifact file type');}}
await collect('.next');await collect('messages');
const list=path.join(out,'archive-files.txt');await write('archive-files.txt',Object.keys(files).sort().join('\n')+'\n');
execFileSync('tar',['-czf',path.join(out,'application.tar.gz'),'-T',list],{stdio:'pipe',env:{...process.env,COPYFILE_DISABLE:'1'}});
const runtime={'.controlled-onboarding/review-access-requests.mjs':operatorHash};
const packages=['next','react','react-dom','next-intl','@prisma/client','@prisma/adapter-pg','@better-auth/prisma-adapter','better-auth','pg','nodemailer','zod','prisma'];
for(const name of packages){const file=`node_modules/${name}/package.json`;runtime[file]=await hashFile(file);}
for(const name of ['query_compiler_fast_bg.postgresql.mjs','query_compiler_fast_bg.postgresql.wasm-base64.mjs']){const file=`node_modules/@prisma/client/runtime/${name}`;runtime[file]=await hashFile(file);}
if(dependencyMode!=='EXACT_SOURCE_METADATA'){
 for(const [name,h] of Object.entries(runtime))if(preflight.runtimeProbe.files[name]!==h)throw new Error('Installed runtime fingerprint mismatch: '+name);
 for(const [name,h] of [['package.json',preflight.packageHash],['package-lock.json',preflight.lockHash]])if(preflight.runtimeProbe.files[name]!==h)throw new Error('Probe metadata drift');
}
const packageFiles={};for(const name of await fs.readdir(out))packageFiles[name]=await hashFile(path.join(out,name));
const manifest={version:1,dependency_mode:dependencyMode,operator_pin_source:preflight.retainedOperatorHash?'PREFLIGHT':'HISTORICAL_ACCEPTED_PIN_FAIL_ON_DRIFT',build_id:buildId,previous_build:preflight.buildId,runtime_package:preflight.packageHash,runtime_lock:preflight.lockHash,runtime_files:runtime,prior_migrations:prior,approved_accounts:approved,application_files:files,package_files:packageFiles};
await write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({prepared:out,manifestSha256:await hashFile(path.join(out,'manifest.json')),buildId,applicationFiles:Object.keys(files).length,deployed:false},null,2));
