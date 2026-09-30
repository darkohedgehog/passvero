export type StandardPlanSlug = "start" | "business" | "pro";
export type PlanLimits = {maxPublishedProducts:number;maxStoredProducts:number;maxStorageBytes:number;maxPdfAttachments:number};
export type StandardPlan = {slug:StandardPlanSlug;name:string;quarterlyPriceCents:number;yearlyPriceCents:number;limits:PlanLimits};
export const STANDARD_PLANS: readonly StandardPlan[] = Object.freeze([
  {slug:"start",name:"Start",quarterlyPriceCents:14700,yearlyPriceCents:49000,limits:{maxPublishedProducts:25,maxStoredProducts:100,maxStorageBytes:2*1024**3,maxPdfAttachments:10}},
  {slug:"business",name:"Business",quarterlyPriceCents:29700,yearlyPriceCents:99000,limits:{maxPublishedProducts:100,maxStoredProducts:400,maxStorageBytes:10*1024**3,maxPdfAttachments:10}},
  {slug:"pro",name:"Pro",quarterlyPriceCents:59700,yearlyPriceCents:199000,limits:{maxPublishedProducts:500,maxStoredProducts:2000,maxStorageBytes:50*1024**3,maxPdfAttachments:10}},
].map(plan=>Object.freeze({...plan,limits:Object.freeze(plan.limits)})) as StandardPlan[]);
export function getStandardPlan(slug: StandardPlanSlug): StandardPlan {
  const plan=STANDARD_PLANS.find(value=>value.slug===slug);
  if(!plan) throw new RangeError("Unknown standard plan");
  return plan;
}
export function quotePlan(slug: StandardPlanSlug, months: 3 | 12) {
  if(months!==3&&months!==12) throw new RangeError("Unsupported commercial period");
  const plan=getStandardPlan(slug);
  return {slug:plan.slug,name:plan.name,months,priceCents:months===3?plan.quarterlyPriceCents:plan.yearlyPriceCents,currency:"EUR" as const,limits:plan.limits};
}
