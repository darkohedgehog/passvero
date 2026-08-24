import "server-only";

import { createPassveroPasswordCallbacks } from "@/src/infrastructure/auth/better-auth-password-core";

export const betterAuthPasswordCallbacks = createPassveroPasswordCallbacks();
