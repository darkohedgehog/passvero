import { getBillingHandler } from "@/src/infrastructure/billing/billing-runtime";
export const dynamic="force-dynamic";
export async function GET(request:Request){return getBillingHandler()(request);}
export async function POST(request:Request){return getBillingHandler()(request);}
