import { z } from "zod";
import { DocumentError } from "@/src/application/documents/contracts";

export const trustedScanPathSchema = z.string().min(2).max(4096)
  .regex(/^\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/);
const signature = z.string().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
  .refine(value => !/^(Heuristics|PUA)\./i.test(value));
const configSchema = z.object({
  qpdfLauncherPath: z.literal("/usr/local/libexec/passvero-qpdf-launch"),
  qpdfTemporaryRoot: z.literal("/run/passvero-qpdf/input"),
  clamavSocketPath: trustedScanPathSchema.max(100),
  healthEvidencePath: trustedScanPathSchema,
  malwareSignatures: z.array(signature).min(1).max(256)
    .refine(values => new Set(values.map(value => value.toLowerCase())).size === values.length),
}).strict().refine(value => value.healthEvidencePath !== value.clamavSocketPath);
export type DocumentScanConfig = z.infer<typeof configSchema>;
/** Server composition values only. Never parse request/tenant configuration here. */
export function parseDocumentScanConfig(input: unknown): DocumentScanConfig {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) throw new DocumentError("OPERATIONAL_FAILURE");
  return parsed.data;
}
