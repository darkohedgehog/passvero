import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewPath =
  "docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md";

test("authentication review records the exact candidate versions and exclusions", async () => {
  const review = await readFile(reviewPath, "utf8");
  assert.match(review, /better-auth: 1\.7\.1/);
  assert.match(review, /@better-auth\/prisma-adapter: 1\.7\.1/);
  assert.match(review, /Prisma: 7\.8\.0/);
  assert.match(review, /Organization plugin: EXCLUDED/);
  assert.match(review, /Admin plugin: EXCLUDED/);
  assert.match(review, /OAuth plugin: EXCLUDED/);
  assert.match(review, /Magic-link plugin: EXCLUDED/);
  assert.match(review, /2FA plugin: EXCLUDED/);
  assert.match(review, /Passkey plugin: EXCLUDED/);
  assert.match(review, /Redis: EXCLUDED/);
  assert.match(review, /Public signup: EXCLUDED/);
  assert.match(review, /Automatic linking: EXCLUDED/);
  assert.match(review, /Database connection performed: NO/);
});
