import { z } from "zod";
const common = { operator: z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/), confirm: z.literal("APPLY") };
const email = z.string().trim().toLowerCase().email().max(254);
export const onboardingOperatorSchema = z.discriminatedUnion("action", [
  z.object({ ...common, action: z.enum(["grant", "revoke"]), email }).strict(),
  z.object({ ...common, action: z.literal("configure-notifications"), recipient: email, enabled: z.boolean() }).strict(),
  z.object({ ...common, action: z.enum(["prepare-notification", "send-notification", "retry-notification"]), id: z.uuid() }).strict(),
]);
