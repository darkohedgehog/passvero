// Fresh local cluster only. No runtime URL fallback, dotenv, remote DB or scanner access.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { Pool } from 'pg';
const root=resolve('.'),work=mkdtempSync('/private/tmp/passvero-gtin-proof-');
const pg='/opt/homebrew/opt/postgresql@16/bin';
const env={PATH:process.env.PATH,HOME:work,TMPDIR:work,LANG:'C',PRISMA_HIDE_UPDATE_MESSAGE:'1'};
function run(command,args,extra={}) {const r=spawnSync(command,args,{cwd:root,env:{...env,...extra},encoding:'utf8',timeout:300000});assert.equal(r.status,0,`${r.error?.message??''}\n${r.stdout}\n${r.stderr}`);return r.stdout;}
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));assert.ok(![5432,5433].includes(port));
const data=work+'/data',latest='20260920120000_one_gtin_per_version';
const dirs=readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort();assert.equal(dirs.at(-1),latest);
mkdirSync(work+'/migrations');cpSync('prisma/migrations/migration_lock.toml',work+'/migrations/migration_lock.toml');
for(const dir of dirs.filter(n=>n!==latest))cpSync('prisma/migrations/'+dir,work+'/migrations/'+dir,{recursive:true});
cpSync('prisma/schema.prisma',work+'/schema.prisma');writeFileSync(work+'/prisma.config.ts',`export default {schema:${JSON.stringify(work+'/schema.prisma')},migrations:{path:${JSON.stringify(work+'/migrations')}},datasource:{url:process.env.GTIN_PROOF_URL}};`);
const url=(name,user='proof')=>`postgresql://${user}:local-proof@127.0.0.1:${port}/${name}`;
function deploy(name){run(process.execPath,[root+'/node_modules/prisma/build/index.js','migrate','deploy','--config',work+'/prisma.config.ts'],{GTIN_PROOF_URL:url(name)});}
let started=false;const pools=[];
try {
 run(pg+'/initdb',['-D',data,'-U','proof','-A','trust','--no-locale']);run(pg+'/pg_ctl',['-D',data,'-l',work+'/postgres.log','-o',`-h 127.0.0.1 -p ${port} -k ${work}`,'-w','start']);started=true;
 const admin=new Pool({connectionString:url('postgres')});pools.push(admin);assert.equal((await admin.query('SHOW data_directory')).rows[0].data_directory,data);
 for(const name of ['gtin_existing_test','gtin_empty_test'])await admin.query(`CREATE DATABASE ${name}`);
 deploy('gtin_existing_test');deploy('gtin_empty_test');
 const db=new Pool({connectionString:url('gtin_existing_test')});pools.push(db);
 await db.query(`INSERT INTO "Organization" (id,"displayName","updatedAt") VALUES ('00000000-0000-4000-8000-000000000001','Existing tenant',now()); INSERT INTO "Product" (id,"organizationId","internalName","publicCode","updatedAt") VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Existing product','ExistingProductCode01',now());`);
 await db.query(`INSERT INTO "ProductVersion" (id,"productId","organizationId","sourceLocale","updatedAt") VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','hr',now()); INSERT INTO "ProductIdentifier" (id,"productVersionId",type,value,"updatedAt") VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','GTIN','012345000058',now()),('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000003','GTIN','6291041500213',now());`);
 const duplicateBefore=(await db.query('SELECT * FROM "ProductIdentifier" ORDER BY id')).rows;
 const migration=readFileSync('prisma/migrations/'+latest+'/migration.sql','utf8');
 await assert.rejects(db.query(migration), /GTIN_DUPLICATE_VERSIONS/);
 await db.query('ROLLBACK');
 assert.deepEqual((await db.query('SELECT * FROM "ProductIdentifier" ORDER BY id')).rows,duplicateBefore);
 // Only this disposable synthetic fixture is removed to exercise the successful migration.
 await db.query(`DELETE FROM "ProductIdentifier" WHERE id='00000000-0000-4000-8000-000000000005'`);
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename")).rows;
 async function snapshot(){const out={};for(const {tablename} of tables)out[tablename]=(await db.query(`SELECT to_jsonb(t) AS row FROM "${tablename}" t ORDER BY to_jsonb(t)::text`)).rows;return out;}
 const before=await snapshot();cpSync('prisma/migrations/'+latest,work+'/migrations/'+latest,{recursive:true});deploy('gtin_existing_test');deploy('gtin_empty_test');assert.deepEqual(await snapshot(),before);

 await admin.query('CREATE ROLE gtin_test_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
 const empty=new Pool({connectionString:url('gtin_empty_test')});pools.push(empty);
 await empty.query('GRANT USAGE ON SCHEMA public TO gtin_test_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gtin_test_app');
 console.log('ADDITIVE_MIGRATION_EXISTING_AND_EMPTY=PASS; NO_BACKFILL; EXISTING_ROWS_UNCHANGED');
 console.log(run(process.execPath,['--import','tsx','--test','--test-concurrency=1','tests/integration/gtin-postgresql.test.ts','tests/integration/create-draft-from-published-postgresql.test.ts','tests/integration/publish-product-postgresql.test.ts'],{TEST_DATABASE_URL:url('gtin_empty_test','gtin_test_app')}));
} finally {await Promise.all(pools.map(p=>p.end()));if(started)run(pg+'/pg_ctl',['-D',data,'-m','fast','-w','stop']);console.log('DISPOSABLE_CLUSTER_STOPPED; '+work);}
