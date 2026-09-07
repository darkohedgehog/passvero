import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const read = file => readFileSync(file, "utf8");
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(file);
    return /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

test("canonical accessor is server-only, lazy, and independent of service configuration", () => {
  const source = read("src/infrastructure/config/canonical-app-origin.ts");
  assert.match(source, /^import "server-only";/);
  assert.match(source, /process\.env\.BETTER_AUTH_URL/);
  assert.doesNotMatch(source, /BETTER_AUTH_SECRET|PASSVERO_TRUSTED_PROXY_SECRET|Prisma|SMTP/);
  assert.doesNotMatch(read("src/lib/site.ts"), /SITE_URL|https:\/\/passvero\.eu|process\.env/);
  assert.match(read("src/infrastructure/public-dpp/public-dpp-http-runtime.ts"), /canonicalOrigin: getCanonicalAppOrigin\(\)/);
  for (const file of ["app/robots.ts", "app/sitemap.ts", "app/[locale]/layout.tsx"]) assert.match(read(file), /getCanonicalAppOrigin\(\)/);
});

test("runtime missing origin and missing/malformed proxy configuration fail closed without services", () => {
  const script = `const assert = require('node:assert/strict');
    const {getCanonicalAppOrigin} = require('./src/infrastructure/config/canonical-app-origin.ts');
    assert.throws(() => getCanonicalAppOrigin(), /Canonical application origin configuration is invalid/);
    process.env.BETTER_AUTH_URL = 'https://passvero.invalid';
    assert.equal(getCanonicalAppOrigin(), 'https://passvero.invalid');
    const {verifyRuntimeProxy} = require('./src/infrastructure/http/trusted-proxy-runtime.ts');
    for (const value of ['', 'malformed']) {
      process.env.PASSVERO_TRUSTED_PROXY_SECRET = value;
      assert.throws(() => verifyRuntimeProxy(new Headers()), /Trusted request configuration is invalid/);
    }`;
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "-e", script], {
    encoding: "utf8", env: { ...process.env, BETTER_AUTH_URL: "", PASSVERO_TRUSTED_PROXY_SECRET: "", BETTER_AUTH_SECRET: "",
      DATABASE_URL: "", AUTH_DATABASE_URL: "", TEST_DATABASE_URL: "" },
  });
  assert.equal(result.status, 0, result.stderr);
});

test("client import graph contains no server origin accessor or proxy credential implementation", () => {
  const roots = [...files("src/components"), ...files("app")].filter(file => /^\s*["']use client["'];/m.test(read(file)));
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = read(file);
    assert.doesNotMatch(source, /import ["']server-only["']|PASSVERO_TRUSTED_PROXY_SECRET|PASSVERO_RUNTIME_ENV|runtime-database-config|runtime-environment|timingSafeEqual|process\.env\.BETTER_AUTH_URL/, file);
    const imports = source.matchAll(/(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s*["']([^"']+)["']/g);
    for (const [, target] of imports) {
      const base = target.startsWith("@/") ? target.slice(2) : target.startsWith(".") ? path.join(path.dirname(file), target) : null;
      if (base === null) continue;
      const resolved = [base, ...[".ts", ".tsx", ".js", "/index.ts", "/index.tsx"].map(ext => base + ext)].find(candidate => existsSync(candidate) && /\.[jt]sx?$/.test(candidate));
      if (resolved) visit(resolved);
    }
  }
  roots.forEach(visit);
  assert.ok(roots.length > 0);
});

test("all existing origin-sensitive transport compositions wire the runtime verifier", () => {
  for (const file of ["create-product-http-runtime", "edit-product-draft-http-runtime", "draft-translation-content-http-runtime",
    "product-materials-http-runtime", "cn-classification-http-runtime", "publish-product-http-runtime", "qr-runtime"]) {
    assert.match(read(`src/infrastructure/products/${file}.ts`), /verifyProxy: verifyRuntimeProxy/);
  }
  for (const file of ["src/infrastructure/auth/explicit-auth-http-runtime.ts", "src/infrastructure/context/organization-context-runtime.ts"]) {
    assert.match(read(file), /verifyProxy: verifyRuntimeProxy/);
  }
  for (const file of files("src/application")) {
    assert.doesNotMatch(read(file), /new URL\(request\.url\)\.origin\s*===?/, file);
  }
  assert.doesNotMatch(read("next.config.ts"), /trustHostHeader/);
});
