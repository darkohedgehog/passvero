import { z } from "zod";

// Validate the representation, not allocation, ownership or GS1 registration.
export const gtinSchema = z.string().regex(/^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/).refine(value => {
  let sum = 0;
  for (let index = value.length - 2, weight = 3; index >= 0; index--, weight = 4 - weight) {
    sum += (value.charCodeAt(index) - 48) * weight;
  }
  return (10 - sum % 10) % 10 === value.charCodeAt(value.length - 1) - 48;
});

export function equivalentGtin(left: string, right: string): boolean {
  return gtinSchema.parse(left).padStart(14, "0") === gtinSchema.parse(right).padStart(14, "0");
}

export function gtinSymbology(value: string): "ean8" | "upca" | "ean13" | "itf14" {
  switch (gtinSchema.parse(value).length) {
    case 8: return "ean8";
    case 12: return "upca";
    case 13: return "ean13";
    default: return "itf14";
  }
}
