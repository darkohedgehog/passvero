import { z } from "zod";
import { accessRequestIdSchema } from "./access-request";

export const accessRequestCommandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("list") }).strict(),
  z.object({ command: z.literal("show"), id: accessRequestIdSchema }).strict(),
  z.object({ command: z.enum(["approve", "reject", "retry-delivery"]), id: accessRequestIdSchema, operator: z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/), confirm: z.literal("APPLY") }).strict(),
]);
export function parseAccessRequestCommand(args: readonly string[]) {
  const [command, ...flags] = args;
  const value: Record<string, string | undefined> = { command };
  if (flags.length % 2) throw new Error("INVALID_COMMAND");
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i].slice(2);
    if (!flags[i].startsWith("--") || Object.hasOwn(value, key)) throw new Error("INVALID_COMMAND");
    value[key] = flags[i + 1];
  }
  return accessRequestCommandSchema.parse(value);
}
