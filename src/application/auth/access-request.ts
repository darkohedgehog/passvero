import { z } from "zod";

const label = (maximum: number) => z.string().max(maximum).trim().normalize().min(1).regex(/^[^\u0000-\u001f\u007f]+$/);
export const accessRequestSchema = z.object({
  contactName: label(120),
  email: z.string().max(254).trim().toLowerCase().email().regex(/^(?!\.)(?!.*\.\.)[a-z0-9_'+.\-]*[a-z0-9_+\-]@(?:[a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/),
  organizationDisplayName: label(200),
  locale: z.enum(["hr", "en", "de", "sr", "sl", "pl"]),
}).strict();
export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
export const accessRequestIdSchema = z.uuid();
