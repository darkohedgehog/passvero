// Fresh local cluster only. No runtime URL fallback, dotenv, remote DB or scanner access.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { Pool } from 'pg';
const root=resolve('.'),work=mkdtempSync('/private/tmp/passvero-dashboard-proof-');
const pg='/opt/homebrew/opt/postgresql@16/bin';
const env={PATH:process.env.PATH,HOME:work,TMPDIR:work,LANG:'C',PRISMA_HIDE_UPDATE_MESSAGE:'1'};
function run(command,args,extra={}) {const r=spawnSync(command,args,{cwd:root,env:{...env,...extra},encoding:'utf8',timeout:300000});assert.equal(r.status,0,`${r.error?.message??''}\n${r.stdout}\n${r.stderr}`);return r.stdout;}
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));assert.ok(![5432,5433].includes(port));
const data=work+'/data';
cpSync('prisma/migrations',work+'/migrations',{recursive:true});cpSync('prisma/schema.prisma',work+'/schema.prisma');
writeFileSync(work+'/prisma.config.ts',`export default {schema:${JSON.stringify(work+'/schema.prisma')},migrations:{path:${JSON.stringify(work+'/migrations')}},datasource:{url:process.env.DASHBOARD_PROOF_URL}};`);
const url=`postgresql://proof:local-proof@127.0.0.1:${port}/dashboard_overview_test`;
let started=false;let admin;
try {
 run(pg+'/initdb',['-D',data,'-U','proof','-A','trust','--no-locale']);run(pg+'/pg_ctl',['-D',data,'-l',work+'/postgres.log','-o',`-h 127.0.0.1 -p ${port} -k ${work}`,'-w','start']);started=true;
 admin=new Pool({connectionString:url.replace('/dashboard_overview_test','/postgres')});assert.equal((await admin.query('SHOW data_directory')).rows[0].data_directory,data);
 await admin.query('CREATE DATABASE dashboard_overview_test');
 run(process.execPath,[root+'/node_modules/prisma/build/index.js','migrate','deploy','--config',work+'/prisma.config.ts'],{DASHBOARD_PROOF_URL:url});
 console.log(run(process.execPath,['--import','tsx','--test','tests/integration/dashboard-overview-postgresql.test.ts'],{TEST_DATABASE_URL:url}));
} finally {if(admin)await admin.end();if(started)run(pg+'/pg_ctl',['-D',data,'-m','fast','-w','stop']);console.log('DISPOSABLE_CLUSTER_STOPPED; '+work);}
