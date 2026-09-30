/** Contractual calendar: local Zagreb time, UTC persistence, earlier overlap instant. */
export const COMMERCIAL_TIME_ZONE = "Europe/Zagreb";
export type CalendarAnchor = {
  day: number; endOfMonth: boolean; hour: number; minute: number; second: number; millisecond: number;
};
type Local = { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number };
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: COMMERCIAL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
function local(date: Date): Local {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid commercial date");
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) if (part.type !== "literal") values[part.type] = Number(part.value);
  return {year:values.year,month:values.month,day:values.day,hour:values.hour,minute:values.minute,second:values.second,millisecond:date.getUTCMilliseconds()};
}
function stamp(value: Local): number {
  return Date.UTC(value.year,value.month-1,value.day,value.hour,value.minute,value.second,value.millisecond);
}
function monthDays(year: number, month: number): number { return new Date(Date.UTC(year,month,0)).getUTCDate(); }
function resolve(value: Local): Date {
  const target = stamp(value);
  // Nearby offsets cover both sides of Zagreb's DST transition. Matching both
  // selects the earlier overlap; a gap selects the smallest forward local shift.
  const offsets = new Set([-36,0,36].map(hours=>{
    const date = new Date(target+hours*3600000);
    return stamp(local(date))-date.getTime();
  }));
  const candidates = [...offsets].map(offset=>new Date(target-offset));
  const exact = candidates.filter(date=>stamp(local(date))===target).sort((a,b)=>a.getTime()-b.getTime());
  if (exact.length) return exact[0];
  const forward = candidates.filter(date=>stamp(local(date))>target).sort((a,b)=>stamp(local(a))-stamp(local(b)));
  if (!forward.length) throw new RangeError("Unresolvable commercial date");
  return forward[0];
}
export function calendarAnchor(date: Date): CalendarAnchor {
  const value = local(date);
  return {day:value.day,endOfMonth:value.day===monthDays(value.year,value.month),hour:value.hour,minute:value.minute,second:value.second,millisecond:value.millisecond};
}
function validateAnchor(anchor: CalendarAnchor): void {
  const ranges: Array<[number,number,number]> = [[anchor.day,1,31],[anchor.hour,0,23],[anchor.minute,0,59],[anchor.second,0,59],[anchor.millisecond,0,999]];
  if (typeof anchor.endOfMonth!=="boolean" || ranges.some(([value,min,max])=>!Number.isInteger(value)||value<min||value>max)) throw new RangeError("Invalid calendar anchor");
}
export function addCalendarMonths(date: Date, months: number, anchor: CalendarAnchor = calendarAnchor(date)): Date {
  if (!Number.isSafeInteger(months)||months<1||months>1200) throw new RangeError("Invalid period months");
  validateAnchor(anchor);
  const value = local(date);
  const target = new Date(Date.UTC(value.year,value.month-1+months,1));
  const year=target.getUTCFullYear(), month=target.getUTCMonth()+1;
  return resolve({year,month,day:anchor.endOfMonth?monthDays(year,month):Math.min(anchor.day,monthDays(year,month)),hour:anchor.hour,minute:anchor.minute,second:anchor.second,millisecond:anchor.millisecond});
}
export function addCalendarDays(date: Date, days: number): Date {
  if (!Number.isSafeInteger(days)||days<1||days>36600) throw new RangeError("Invalid calendar days");
  return shiftCalendarDays(date, days);
}
/** Reminder thresholds share the contractual DST resolution, including negative offsets. */
export function shiftCalendarDays(date: Date, days: number): Date {
  if (!Number.isSafeInteger(days)||Math.abs(days)>36600) throw new RangeError("Invalid calendar days");
  const value = local(date);
  const target = new Date(Date.UTC(value.year,value.month-1,value.day+days));
  return resolve({...value,year:target.getUTCFullYear(),month:target.getUTCMonth()+1,day:target.getUTCDate()});
}
/** External offer datetime-local input is explicitly Zagreb, never browser/server local time. */
export function parseCommercialLocalDateTime(value: string): Date {
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if(!match)throw new RangeError("Invalid local commercial datetime");
  const [,yearText,monthText,dayText,hourText,minuteText,secondText]=match;
  const date:Local={year:Number(yearText),month:Number(monthText),day:Number(dayText),hour:Number(hourText),minute:Number(minuteText),second:Number(secondText??0),millisecond:0};
  if(date.year<2000||date.month<1||date.month>12||date.day<1||date.day>monthDays(date.year,date.month)||date.hour>23||date.minute>59||date.second>59)throw new RangeError("Invalid local commercial datetime");
  return resolve(date);
}
