import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

export const passportContentIcons = {
  shortDescription: "document",
  description: "document",
  technicalDescription: "manufacturing",
  repairInstructions: "efficiency",
  sparePartsInformation: "interoperable",
  recyclingInstructions: "efficiency",
  disposalInstructions: "packaging",
  packagingInformation: "packaging",
  safetyInformation: "document",
  warrantyInformation: "receipt",
  publicNotes: "document",
} as const satisfies Record<string, MarketingIconName>;

/** Decorative presentation only; icons do not imply certification or verification. */
export function PassportSectionIcon({ name }: Readonly<{ name: MarketingIconName }>) {
  return <MarketingIcon name={name} className="passport-section-icon size-5 shrink-0 text-teal-700" aria-hidden="true" focusable="false" />;
}
