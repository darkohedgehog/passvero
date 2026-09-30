import assert from "node:assert/strict";
import test from "node:test";
import { reminderThreshold, reminderDecision } from "../../src/application/subscriptions/reminders";
import { renderReminderEmail } from "../../src/infrastructure/subscriptions/reminder-email";
import { TRIAL_LIMITS } from "../../src/application/subscriptions/entitlements";
import { classifyReminderTransportError } from "../../src/infrastructure/subscriptions/reminder-transport";

const end = new Date("2027-03-31T10:00:00Z");
test("Zagreb calendar thresholds cross DST and expiry never precedes the instant", () => {
  assert.equal(reminderThreshold(end, new Date("2027-03-01T10:59:59Z"), true), null);
  assert.equal(reminderThreshold(end, new Date("2027-03-01T11:00:00Z"), true), 30);
  assert.equal(reminderThreshold(end, new Date("2027-03-24T11:00:00Z"), true), 7);
  assert.equal(reminderThreshold(end, new Date("2027-03-30T10:00:00Z"), true), 1);
  assert.equal(reminderThreshold(end, new Date(end.getTime() - 1), true), 1);
  assert.equal(reminderThreshold(end, end, true), 0);
  assert.equal(reminderThreshold(end, end, false), null);
});
const period = { id: "p1", planSlug: "start", start: new Date("2027-01-01T11:00:00Z"), end, limits: TRIAL_LIMITS };
const base = { now: new Date("2027-03-25T11:00:00Z"), trial: null, periods: [period], conditionalPeriodIds: [] as string[], stagingException: false, eligiblePublications: 1 };
test("renewal suppresses obsolete warnings; conditional downgrade and future gaps stay truthful", () => {
  assert.equal(reminderDecision(base).subscription?.consequence, "LOCKS");
  const future = { ...period, id: "p2", start: end, end: new Date("2027-06-30T10:00:00Z") };
  assert.equal(reminderDecision({ ...base, periods: [period, future] }).subscription, null);
  assert.equal(reminderDecision({ ...base, periods: [period, future], conditionalPeriodIds: ["p2"] }).subscription?.consequence, "CONDITIONAL");
  assert.equal(reminderDecision({ ...base, periods: [period, { ...future, start: new Date("2027-04-02T10:00:00Z") }] }).subscription?.consequence, "GAP");
  assert.deepEqual(reminderDecision({ ...base, stagingException: true }), { subscription: null, publicAvailability: null });
  assert.equal(reminderDecision({ ...base, trial: { start: period.start, end }, periods: [{ ...future, start: new Date("2027-03-29T10:00:00Z") }] }).subscription, null);
});
test("transport errors expose only normalized safe classifications, never assume timeout means failure", () => {
  for (const error of [{ code: "ETIMEDOUT", command: "CONN", response: "secret" }, { code: "ESOCKET", command: "DATA" }, new Error("provider credential")]) assert.deepEqual(classifyReminderTransportError(error), { status: "UNKNOWN", reason: "SMTP_OUTCOME_UNKNOWN" });
  assert.equal(classifyReminderTransportError({ code: "ECONNECTION", command: "CONN" }).status, "SAFE_RETRY");
  assert.equal(classifyReminderTransportError({ responseCode: 450, command: "DATA" }).status, "SAFE_RETRY");
  assert.equal(classifyReminderTransportError({ responseCode: 550, command: "RCPT TO" }).status, "FAILED");
  assert.equal(classifyReminderTransportError({ code: "EAUTH", command: "AUTH" }).status, "FAILED");
});
test("public warning uses the same paid grace deadline and requires eligible voluntary publication", () => {
  const input = { ...base, now: new Date("2027-09-25T10:00:00Z") };
  const decision = reminderDecision(input).publicAvailability;
  assert.equal(decision?.deadline.toISOString(), "2027-09-30T10:00:00.000Z");
  assert.equal(decision?.threshold, 7);
  assert.equal(reminderDecision({ ...input, eligiblePublications: 0 }).publicAvailability, null);
  assert.equal(reminderDecision({ ...input, periods: [], trial: { start: period.start, end } }).publicAvailability, null);
});
test("six locales, Croatian fallback, escaped HTML, precise zoned date and protected link", () => {
  const decision = reminderDecision(base).subscription!;
  const subjects = new Set<string>();
  for (const locale of ["hr", "sr", "en", "de", "sl", "pl"]) {
    const email = renderReminderEmail({ organizationName: '<Org & "Test">', locale, decision, operator: false }, "https://staging.passvero.eu");
    subjects.add(email.subject);
    assert.match(email.text, /Europe\/Zagreb/);
    assert.match(email.text, /dashboard\/subscription/);
    assert.ok(!email.html.includes('<Org & "Test">'));
    assert.match(email.html, /&lt;Org/);
  }
  assert.equal(subjects.size, 6);
  assert.deepEqual(renderReminderEmail({ organizationName: "Org", locale: "xx", decision, operator: false }, "https://staging.passvero.eu"), renderReminderEmail({ organizationName: "Org", locale: "hr", decision, operator: false }, "https://staging.passvero.eu"));
  assert.throws(() => renderReminderEmail({ organizationName: "Org", locale: "hr", decision, operator: false }, "https://evil.test/path"));
});
