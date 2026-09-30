// Local bundle preparation only. No credentials, environment files, DB connections or deployment.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url);
const out = process.argv[2];
if (!out || !path.resolve(out).startsWith('/private/tmp/')) throw new Error('Temporary output directory required');
await mkdir(out, { recursive: false, mode: 0o700 });
const result = await build({ entryPoints: ['scripts/subscription-reminder-worker.ts'], outfile: path.join(out, 'worker.cjs'), bundle: true, platform: 'node', target: 'node22', format: 'cjs', packages: 'external', metafile: true,
  plugins: [{ name: 'embed-prisma-compiler', setup(builder) { builder.onResolve({ filter: /^@prisma\/client\/runtime\/query_compiler_fast_bg\.postgresql(?:\.wasm-base64)?\.mjs$/ }, args => ({ path: require.resolve(args.path) })); } }],
  define: { 'import.meta.url': '__operatorModuleUrl' }, banner: { js: 'const __operatorModuleUrl = require("node:url").pathToFileURL(__filename).href;' },
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = {};
for (const file of Object.keys(result.metafile.inputs)) sources[file] = hash(await readFile(file));
const workerSha256 = hash(await readFile(path.join(out, 'worker.cjs')));
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ workerSha256, sources }, null, 2) + '\n');
console.log(JSON.stringify({ bundle: path.join(out, 'worker.cjs'), workerSha256, sourceFiles: Object.keys(sources).length, deployed: false }));
