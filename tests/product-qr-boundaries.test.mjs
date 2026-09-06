import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(path, "utf8");
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]); }
const application = files("src/application/products/qr").map(read).join("\n");
const persistence = read("src/infrastructure/persistence/prisma/prisma-product-qr.ts");
const client = read("src/components/application/products/product-qr-section.tsx");

test("QR application and client boundaries exclude Prisma, auth persistence and renderer libraries", () => {
  assert.doesNotMatch(application, /generated\/prisma|PrismaClient|authPrisma|from ["'](?:qrcode|sharp|node:crypto)/);
  assert.doesNotMatch(client, /from ["'](?:qrcode|sharp)|dangerouslySetInnerHTML|next\/image/);
  assert.doesNotMatch(persistence, /authPrisma|qRCode\.(?:create|upsert|delete)|(?:product|passport|productVersion)\.(?:update|create|upsert|delete)/);
  assert.doesNotMatch(application + persistence + client, /scanEvent|user-agent|fingerprintCookie|\/q\/|QRCODE_REGENERATE/);
});
test("all four QR routes remain dynamic authenticated server entry points with sanitized runtime failures", () => {
  for (const route of ["qr/activate", "qr.svg", "qr.png", "qr/preview.svg"]) {
    const source = read(`app/api/products/[productId]/${route}/route.ts`);
    assert.match(source, /runtime = "nodejs"/);
    assert.match(source, /dynamic = "force-dynamic"/);
    assert.match(source, /fetchCache = "force-no-store"/);
    assert.match(source, /getProductQrRuntime\(\)\.http\./);
    assert.match(source, /catch \(error\) \{ return qrHttpFailure\(error\); \}/);
  }
});
test("UI wiring retains synchronous duplicate-submit guard, explicit stale reload and accessible result focus", () => {
  assert.match(client, /if \(inFlight\.current \|\| result\?\.status === "STALE_WRITE"/);
  assert.ok(client.indexOf("inFlight.current = true") < client.indexOf("await activateQrFromDashboard"));
  assert.match(client, /window\.confirm\(labels\.confirm\)/);
  assert.match(client, /disabled=\{pending \|\| result\?\.status === "STALE_WRITE"\}/);
  assert.match(client, /resultRef\.current\?\.focus\(\)/);
  assert.match(client, /tabIndex=\{-1\} aria-live="polite"/);
  assert.match(client, /aria-busy=\{pending\}/);
  assert.match(client, /referrerPolicy="no-referrer"/);
  assert.match(read("src/components/application/products/product-detail-presentation.tsx"), /\{qrSection\}/);
});
