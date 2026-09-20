// Fresh local cluster only. No runtime URL fallback, dotenv, remote DB or scanner access.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { Pool } from 'pg';
const root=resolve('.'),work=mkdtempSync('/private/tmp/passvero-image-proof-');
const pg='/opt/homebrew/opt/postgresql@16/bin';
const env={PATH:process.env.PATH,HOME:work,TMPDIR:work,LANG:'C',PRISMA_HIDE_UPDATE_MESSAGE:'1'};
function run(command,args,extra={}) {const r=spawnSync(command,args,{cwd:root,env:{...env,...extra},encoding:'utf8',timeout:300000});assert.equal(r.status,0,`${r.error?.message??''}\n${r.stdout}\n${r.stderr}`);return r.stdout;}
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));assert.ok(![5432,5433].includes(port));
const data=work+'/data',latest='20260920180000_product_image_assets';
const dirs=readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort();assert.equal(dirs.at(-1),latest);
mkdirSync(work+'/migrations');cpSync('prisma/migrations/migration_lock.toml',work+'/migrations/migration_lock.toml');
for(const dir of dirs.filter(n=>n!==latest))cpSync('prisma/migrations/'+dir,work+'/migrations/'+dir,{recursive:true});
cpSync('prisma/schema.prisma',work+'/schema.prisma');writeFileSync(work+'/prisma.config.ts',`export default {schema:${JSON.stringify(work+'/schema.prisma')},migrations:{path:${JSON.stringify(work+'/migrations')}},datasource:{url:process.env.IMAGE_PROOF_URL}};`);
const url=(name,user='proof')=>`postgresql://${user}:local-proof@127.0.0.1:${port}/${name}`;
function deploy(name){run(process.execPath,[root+'/node_modules/prisma/build/index.js','migrate','deploy','--config',work+'/prisma.config.ts'],{IMAGE_PROOF_URL:url(name)});}
let started=false;const pools=[];
try {
 run(pg+'/initdb',['-D',data,'-U','proof','-A','trust','--no-locale']);run(pg+'/pg_ctl',['-D',data,'-l',work+'/postgres.log','-o',`-h 127.0.0.1 -p ${port} -k ${work}`,'-w','start']);started=true;
 const admin=new Pool({connectionString:url('postgres')});pools.push(admin);assert.equal((await admin.query('SHOW data_directory')).rows[0].data_directory,data);
 for(const name of ['image_existing_test','image_empty_test'])await admin.query(`CREATE DATABASE ${name}`);
 deploy('image_existing_test');deploy('image_empty_test');
 const db=new Pool({connectionString:url('image_existing_test')});pools.push(db);
 await db.query(`INSERT INTO "Organization" (id,"displayName","updatedAt") VALUES ('00000000-0000-4000-8000-000000000001','Existing tenant',now()); INSERT INTO "Product" (id,"organizationId","internalName","publicCode","updatedAt") VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Existing product','ExistingProductCode01',now());`);
 await db.query(`INSERT INTO "ProductVersion" (id,"productId","organizationId","sourceLocale","updatedAt") VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','hr',now());`);
 for (const suffix of ['004','005']) await db.query(`INSERT INTO "ProductImage" (id,"productVersionId","originalFilename","storageProvider","storageBucket","storageKey","mimeType","sizeBytes","checksumSha256",width,height,"altText",caption,"isPrimary","isPublic","updatedAt") VALUES ($1::uuid,'00000000-0000-4000-8000-000000000003','legacy.png','legacy','legacy',($1::uuid)::text,'image/png',1,$2,1,1,'original alt','original caption',true,false,now())`,['00000000-0000-4000-8000-000000000'+suffix,'a'.repeat(64)]);
 await db.query('CREATE ROLE image_legacy_reader; GRANT SELECT ON "ProductImage" TO image_legacy_reader');
 const before=(await db.query('SELECT * FROM "ProductImage" ORDER BY id')).rows;
 const uniqueBefore=(await db.query(`SELECT oid FROM pg_class WHERE relname='ProductImage_storageProvider_storageBucket_storageKey_key'`)).rows[0].oid;
 cpSync('prisma/migrations/'+latest,work+'/migrations/'+latest,{recursive:true});deploy('image_existing_test');deploy('image_empty_test');
 const after=(await db.query(`SELECT i.*,a."originalFilename",a."fileExtension",a."storageProvider",a."storageBucket",a."storageKey",a."mimeType",a."sizeBytes",a."checksumSha256",a.width,a.height,a."uploadedAt" FROM "ProductImage" i JOIN "ProductImageAsset" a ON a.id=i."assetId" ORDER BY i.id`)).rows.map(row=>{const copy={...row};delete copy.assetId;return copy;});
 assert.deepEqual(after,before);
 assert.equal((await db.query(`SELECT oid FROM pg_class WHERE relname='ProductImage_storageProvider_storageBucket_storageKey_key'`)).rows[0].oid,uniqueBefore);
 assert.equal((await db.query(`SELECT has_table_privilege('image_legacy_reader','"ProductImage"','SELECT') AS permitted`)).rows[0].permitted,true);
 assert.equal((await db.query(`SELECT has_table_privilege('image_legacy_reader','"ProductImage"','UPDATE') AS permitted`)).rows[0].permitted,false);
 await db.query(readFileSync('tests/proofs/product-image-rollback.sql','utf8'));
 assert.deepEqual((await db.query('SELECT * FROM "ProductImage" ORDER BY id')).rows,before);
 assert.equal((await db.query(`SELECT has_table_privilege('image_legacy_reader','"ProductImage"','SELECT') AS permitted`)).rows[0].permitted,true);
 console.log('SCHEMA_ONLY_ROLLBACK_PRESERVES_LEGACY_ROWS=PASS');
 console.log('MIGRATION_LEGACY_ROWS_AND_UNIQUE_INDEX_PRESERVED=PASS; MULTIPLE_PRIMARY_ROWS_RETAINED');

 await admin.query('CREATE ROLE image_test_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
 const empty=new Pool({connectionString:url('image_empty_test')});pools.push(empty);
 await empty.query('GRANT USAGE ON SCHEMA public TO image_test_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO image_test_app');
 console.log('ASSET_NORMALIZATION_MIGRATION_EXISTING_AND_EMPTY=PASS');
 console.log(run(process.execPath,['--import','tsx','--test','--test-concurrency=1','tests/integration/product-images-postgresql.test.ts','tests/integration/gtin-postgresql.test.ts','tests/integration/manufacturer-postgresql.test.ts','tests/integration/create-draft-from-published-postgresql.test.ts','tests/integration/publish-product-postgresql.test.ts'],{TEST_DATABASE_URL:url('image_empty_test','image_test_app')}));
} finally {await Promise.all(pools.map(p=>p.end()));if(started)run(pg+'/pg_ctl',['-D',data,'-m','fast','-w','stop']);console.log('DISPOSABLE_CLUSTER_STOPPED; '+work);}
