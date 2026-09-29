import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
const require=createRequire(root+'/package.json');
const {build}=require('esbuild');
const compilerPlugin={name:'include-prisma-compiler',setup(b){b.onResolve({filter:/^@prisma\/client\/runtime\/query_compiler_fast_bg\.postgresql(?:\.wasm-base64)?\.mjs$/},args=>({path:require.resolve(args.path)}));}};
const options={bundle:true,platform:'node',format:'cjs',packages:'external',logLevel:'silent'};
const contents=`(async()=>{const runtime=await import('@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs');const {wasm}=await import('@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs');new WebAssembly.Module(Buffer.from(wasm,'base64'));console.log(JSON.stringify({compiler:'PASS',runtimeExports:Object.keys(runtime).length}));})().catch(e=>{console.log(JSON.stringify({compiler:'FAIL',code:e.code}));process.exitCode=1;});`;
for(const fixed of [false,true]){
 const outfile='/tmp/passvero-platform-procedure/compiler-'+(fixed?'fixed':'before')+'.cjs';
 await build({...options,stdin:{contents,resolveDir:root},plugins:fixed?[compilerPlugin]:[],outfile});
 const result=spawnSync(process.execPath,[outfile],{cwd:'/',encoding:'utf8',env:{PATH:process.env.PATH,NODE_PATH:root+'/node_modules'}});
 console.log(JSON.stringify({fixed,status:result.status,output:result.stdout.trim()}));
 if(result.status!==(fixed?0:1))throw new Error('Unexpected reproduction');
}
for(const [entry,outfile] of [['scripts/platform-access.ts','/tmp/passvero-platform-c513679/platform-access-fixed.cjs'],['/tmp/passvero-platform-procedure/diagnostic-entry.ts','/tmp/passvero-platform-c513679/diagnostic-fixed.cjs']]){
 await build({...options,entryPoints:[entry],outfile,plugins:[compilerPlugin,{name:'server-only-cli',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'',loader:'js'}));}}],define:{'import.meta.url':'__operatorModuleUrl'},banner:{js:'const __operatorModuleUrl = require("node:url").pathToFileURL(__filename).href;'}});
}
