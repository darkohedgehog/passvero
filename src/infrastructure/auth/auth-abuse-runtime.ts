import "server-only";

import { createAuthAbuseService } from "../../application/auth/auth-abuse-service";
import { getProductionPrismaClient } from "../persistence/prisma/production-prisma-runtime";
import { createAuthAbuseKeyDeriver } from "./auth-abuse-key";
import {
  canonicalizeAuthAccountIdentifier,
  normalizeTrustedClientNetwork,
} from "./auth-abuse-identifiers";
import { PrismaAuthAbuseRepository } from "./prisma-auth-abuse-repository";

export function createBusinessAuthAbuseService(input: {
  readonly hmacSecret: Uint8Array;
  readonly now?: () => Date;
}) {
  return createAuthAbuseService({
    repository: new PrismaAuthAbuseRepository(getProductionPrismaClient()),
    canonicalizeAccountIdentifier: canonicalizeAuthAccountIdentifier,
    normalizeTrustedClientNetwork,
    deriveKeys: createAuthAbuseKeyDeriver(input.hmacSecret),
    now: input.now ?? (() => new Date()),
  });
}
