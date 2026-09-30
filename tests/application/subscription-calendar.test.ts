import assert from 'node:assert/strict';
import test from 'node:test';
import { addCalendarDays, addCalendarMonths, calendarAnchor, parseCommercialLocalDateTime } from '../../src/application/subscriptions/calendar';
import { getStandardPlan, quotePlan } from '../../src/application/subscriptions/catalog';

test('commercial prices are totals, quotas are explicit, and unknown periods fail', () => {
  assert.equal(quotePlan('start', 3).priceCents,14700);
  assert.equal(quotePlan('start', 12).priceCents,49000);
  assert.equal(quotePlan('business', 3).priceCents,29700);
  assert.equal(quotePlan('business', 12).priceCents,99000);
  assert.equal(quotePlan('pro', 3).priceCents,59700);
  assert.equal(quotePlan('pro', 12).priceCents,199000);
  assert.deepEqual(getStandardPlan('pro').limits,{maxPublishedProducts:500,maxStoredProducts:2000,maxStorageBytes:50*1024**3,maxPdfAttachments:10});
  assert.throws(()=>quotePlan('start', 1 as 3));
});
test('calendar months preserve Zagreb time and month-end anchor across renewals',()=>{
  const start=new Date('2027-01-31T09:15:30.123Z');
  const anchor=calendarAnchor(start);
  const end=addCalendarMonths(start,3,anchor);
  assert.equal(end.toISOString(),'2027-04-30T08:15:30.123Z');
  assert.equal(addCalendarMonths(end,3,anchor).toISOString(),'2027-07-31T08:15:30.123Z');
  assert.equal(addCalendarMonths(new Date('2024-02-29T09:00:00Z'),12).toISOString(),'2025-02-28T09:00:00.000Z');
});
test('clamped non-month-end dates retain original day and leap-year anchors',()=>{
  const start=new Date('2026-01-30T11:00:00Z');const anchor=calendarAnchor(start);
  const feb=addCalendarMonths(start,1,anchor);
  assert.equal(feb.toISOString(),'2026-02-28T11:00:00.000Z');
  assert.equal(addCalendarMonths(feb,1,anchor).toISOString(),'2026-03-30T10:00:00.000Z');
});
test('spring DST gap moves by gap and autumn overlap uses earlier instant',()=>{
  assert.equal(addCalendarMonths(new Date('2025-12-29T01:30:00Z'),3).toISOString(),'2026-03-29T01:30:00.000Z');
  assert.equal(addCalendarMonths(new Date('2026-07-25T00:30:00Z'),3).toISOString(),'2026-10-25T00:30:00.000Z');
});
test('offer days are local calendar days, not multiples of 24h',()=>{
  assert.equal(addCalendarDays(new Date('2026-03-01T11:00:00Z'),30).toISOString(),'2026-03-31T10:00:00.000Z');
  assert.equal(addCalendarDays(new Date('2026-10-01T10:00:00Z'),30).toISOString(),'2026-10-31T11:00:00.000Z');
  assert.throws(()=>addCalendarMonths(new Date('invalid'),3));
  assert.throws(()=>addCalendarMonths(new Date(),0));
  assert.throws(()=>addCalendarMonths(new Date(),0.5));
});
test('renewal reuses original wall-clock anchor after spring gap and leap clamps',()=>{
  const start=new Date('2025-12-29T01:30:00Z'),anchor=calendarAnchor(start);
  const gap=addCalendarMonths(start,3,anchor);
  assert.equal(addCalendarMonths(gap,3,anchor).toISOString(),'2026-06-29T00:30:00.000Z');
  let leap=new Date('2024-02-29T09:00:00Z');const leapAnchor=calendarAnchor(leap);
  for(let year=0;year<4;year++)leap=addCalendarMonths(leap,12,leapAnchor);
  assert.equal(leap.toISOString(),'2028-02-29T09:00:00.000Z');
});

test('external offer local issuance uses Zagreb including DST and rejects invalid calendar text',()=>{
  assert.equal(parseCommercialLocalDateTime('2026-09-30T12:15').toISOString(),'2026-09-30T10:15:00.000Z');
  assert.equal(parseCommercialLocalDateTime('2026-03-29T02:30').toISOString(),'2026-03-29T01:30:00.000Z');
  assert.equal(parseCommercialLocalDateTime('2026-10-25T02:30:10').toISOString(),'2026-10-25T00:30:10.000Z');
  for(const value of ['2026-02-29T12:00','2026-13-01T12:00','2026-09-30T24:00','2026-09-30T12:00Z','invalid'])assert.throws(()=>parseCommercialLocalDateTime(value));
});
