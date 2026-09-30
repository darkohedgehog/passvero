import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getRegulatoryService, regulatoryActor } from "@/src/infrastructure/subscriptions/regulatory-runtime";
import { RegulatoryOverview } from "@/src/components/application/subscriptions/regulatory-overview";
export const dynamic = "force-dynamic";
export default async function RegulatoryPage() {
  let rows;
  try { rows = await getRegulatoryService().list(await regulatoryActor(await headers())); }
  catch { notFound(); }
  return <RegulatoryOverview rows={rows} />;
}
