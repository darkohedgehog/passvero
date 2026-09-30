// Local preparation only. Approved fixture tool and operator driver; no transport execution.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(import.meta.url), out = path.resolve(process.argv[2] ?? '.');
if (path.dirname(out) !== '/private/tmp') throw new Error('New temporary output directory required');
const hash = data => createHash('sha256').update(data).digest('hex');
const packageInfo = JSON.parse(await readFile('codex/evidence/subscription-reminders/deployment-package.json', 'utf8'));
const deploymentBytes = await readFile(packageInfo.package.replace(/\.tar\.gz$/, '') + '/manifest.json');
if (hash(deploymentBytes) !== packageInfo.manifestSha256) throw new Error('Deployment pin mismatch');
const deployment = JSON.parse(deploymentBytes);
const proposal = JSON.parse(await readFile('codex/evidence/subscription-reminders/delivery-proposal.json', 'utf8'));
if (proposal.status !== 'APPROVED_BY_USER' || proposal.maximumSmtpDispatches !== 4) throw new Error('Explicit approval required');
await mkdir(out, { mode: 0o700 });
const result = await build({ entryPoints: ['scripts/subscription-reminders/acceptance-cli.ts'], outfile: path.join(out, 'acceptance.cjs'), bundle: true, platform: 'node', target: 'node22', format: 'cjs', packages: 'external', metafile: true,
  plugins: [{ name: 'embed-prisma-compiler', setup(builder) { builder.onResolve({ filter: /^@prisma\/client\/runtime\/query_compiler_fast_bg\.postgresql(?:\.wasm-base64)?\.mjs$/ }, args => ({ path: require.resolve(args.path) })); } }],
  define: { 'import.meta.url': '__operatorModuleUrl' }, banner: { js: 'const __operatorModuleUrl = require("node:url").pathToFileURL(__filename).href;' },
});
const sources = {};
for (const file of Object.keys(result.metafile.inputs)) sources[file] = hash(await readFile(file));
if (Object.keys(sources).some(p => /reminder-transport|nodemailer/.test(p))) throw new Error('Fixture bundle must not send email');
await writeFile(path.join(out, 'fixture-source-manifest.json'), JSON.stringify(sources, null, 2) + '\n');
const common = (await readFile('codex/evidence/subscription-entitlements/migrate.py', 'utf8')).split('\ndef main(m):')[0].replace("R=P('/var/lib/passvero-subscription-entitlements')", "R=P('/var/lib/passvero-subscription-reminders')");
await writeFile(path.join(out, 'common.py'), common);
await writeFile(path.join(out, 'acceptance.py'), await readFile('scripts/subscription-reminders/acceptance.py'));
await writeFile(path.join(out, 'delivery-proposal.json'), await readFile('codex/evidence/subscription-reminders/delivery-proposal.json'));
const retained = JSON.parse(await readFile('codex/evidence/subscription-reminders/operator-worker-diagnosis.json', 'utf8')).createdFixtureEvidence;
await writeFile(path.join(out, 'retained-fixtures.json'), JSON.stringify(retained, null, 2) + '\n');
const packageFiles = {};
for (const name of ['common.py','acceptance.py','acceptance.cjs','delivery-proposal.json','fixture-source-manifest.json','retained-fixtures.json']) packageFiles[name] = hash(await readFile(path.join(out, name)));
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ deploymentManifest: packageInfo.manifestSha256, runtime_package: deployment.runtime_package, runtime_lock: deployment.runtime_lock, runtime_files: deployment.runtime_files, package_files: packageFiles }, null, 2) + '\n');
const check = spawnSync(process.execPath, ['--check', path.join(out, 'acceptance.cjs')], { encoding: 'utf8' });
if (check.status !== 0) throw new Error('Bundle syntax failure');
const pack = spawnSync('python3', ['-c', 'import ast,pathlib,sys,tarfile; p=pathlib.Path(sys.argv[1]); [ast.parse(f.read_text()) for f in p.glob("*.py")]; t=tarfile.open(str(p)+".tar.gz","x:gz"); [t.add(f,arcname=f.name,recursive=False) for f in sorted(p.iterdir())]; t.close()', out], { encoding: 'utf8' });
if (pack.status !== 0) throw new Error('Packaging failure');
console.log(JSON.stringify({ package: out + '.tar.gz', packageSha256: hash(await readFile(out + '.tar.gz')), manifestSha256: hash(await readFile(path.join(out, 'manifest.json'))), deploymentManifest: packageInfo.manifestSha256, maximumSmtpDispatches: 4, expiresAt: proposal.expiresAt, transportRunLocally: false }, null, 2));
