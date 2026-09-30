import assert from "node:assert/strict";
import test from "node:test";
import { resolveEntitlements, quotaDenials, trialWindow, publicAvailability, TRIAL_LIMITS, type EntitlementPeriod } from "../../src/application/subscriptions/entitlements";

const start = new Date("2026-09-30T13:22:05.515Z");
const limits = { maxPublishedProducts: 25, maxStoredProducts: 100, maxStorageBytes: 2147483648, maxPdfAttachments: 10 };
const period: EntitlementPeriod = { id: "paid-1", planSlug: "start", start, end: new Date("2026-12-31T14:22:05.515Z"), limits };

test("trial uses the existing Zagreb calendar and expires at its exclusive end", () => {
  const trial = trialWindow(start);
  assert.equal(trial.end.toISOString(), "2027-03-31T13:22:05.515Z");
  assert.equal(resolveEntitlements({ now: start, trial, periods: [] }).kind, "TRIAL");
  assert.equal(resolveEntitlements({ now: trial.end, trial, periods: [] }).kind, "EXPIRED");
  assert.equal(resolveEntitlements({ now: new Date(start.getTime()-1), trial, periods: [] }).kind, "NOT_STARTED");
});
test("paid periods override trial only when they start; future renewal needs no cron", () => {
  const trial = trialWindow(start);
  const next = { ...period, id: "paid-2", start: period.end, end: new Date("2027-03-31T13:22:05.515Z") };
  assert.equal(resolveEntitlements({ now: start, trial, periods: [period, next] }).periodId, "paid-1");
  assert.equal(resolveEntitlements({ now: period.end, trial, periods: [period, next] }).periodId, "paid-2");
  // A previous paid customer must not fall back to remaining trial days.
  assert.equal(resolveEntitlements({ now: period.end, trial, periods: [period] }).kind, "EXPIRED");
});
test("missing or malformed rights never grant unlimited access", () => {
  assert.equal(resolveEntitlements({ now: start, trial: null, periods: [] }).kind, "TRANSITION_REQUIRED");
  assert.throws(() => resolveEntitlements({ now: start, trial: null, periods: [{ ...period, limits: { ...limits, maxStorageBytes: null } }] }));
  assert.throws(() => resolveEntitlements({ now: start, trial: null, periods: [period, { ...period, id: "overlap" }] }));
});
test("quota checks preserve occupied slots, retained assets and trial lifetime creations", () => {
  const usage = { storedProducts: 2, occupiedPublishedProducts: 2, storageBytes: 100 * 1024 * 1024, maxPdfAttachmentsPerVersion: 5, lifetimeCreatedProducts: 3 };
  assert.deepEqual(quotaDenials(TRIAL_LIMITS, usage, { storedProducts: 1, trial: true }), ["TRIAL_CREATION_LIMIT"]);
  assert.deepEqual(quotaDenials(TRIAL_LIMITS, usage, { storageBytes: 1 }), ["STORAGE_LIMIT"]);
  assert.deepEqual(quotaDenials(TRIAL_LIMITS, { ...usage, occupiedPublishedProducts: 3 }, { publishedProducts: 1 }), ["PUBLICATION_LIMIT"]);
  assert.deepEqual(quotaDenials(TRIAL_LIMITS, usage, { pdfAttachments: 1 }), ["PDF_ATTACHMENT_LIMIT"]);
  assert.deepEqual(quotaDenials(TRIAL_LIMITS, usage, {}), []);
});
test("public grace uses calendar boundaries and never extends expired trial", () => {
  const trial = trialWindow(start);
  assert.equal(publicAvailability({ now: trial.end, trial, periods: [], classification: "VOLUNTARY" }).allowed, false);
  assert.equal(publicAvailability({ now: period.end, trial, periods: [period], classification: "VOLUNTARY" }).allowed, true);
  assert.equal(publicAvailability({ now: new Date("2027-06-30T13:22:05.515Z"), trial, periods: [period], classification: "VOLUNTARY" }).allowed, false);
  for (const classification of ["UNRESOLVED", "MANDATORY"] as const) {
    assert.equal(publicAvailability({ now: new Date("2030-01-01Z"), trial, periods: [period], classification }).reason, "SEPARATE_POLICY_REQUIRED");
  }
});
