import { z } from "zod";
import type { CurrentUserResolution } from "./resolve-current-user";
import type { PlatformActor } from "../platform/service";
import { ApplicationError } from "../errors/application-error";
export const onboardingApprovalSchema = z.object({ id: z.uuid(), confirm: z.literal("APPROVE_AND_SEND_ACTIVATION") }).strict();
export type OnboardingApprovalResult = {
  status: string;
  deliveryStatus?: string;
};
export function onboardingDenied() { return new ApplicationError("FORBIDDEN", "ONBOARDING_FORBIDDEN", "Access denied.", false); }
export function createOnboardingServices(deps: {
  resolve(headers: Headers): Promise<CurrentUserResolution>;
  authorize(actor: PlatformActor): Promise<boolean>;
  approve(actor: PlatformActor, id: string): Promise<OnboardingApprovalResult>;
}) {
  return {
    async canApprove(headers: Headers) {
      const actor = await deps.resolve(headers);
      return actor.status === "AUTHENTICATED" && await deps.authorize(actor);
    },
    async approve(headers: Headers, input: unknown) {
      const actor = await deps.resolve(headers);
      if (actor.status !== "AUTHENTICATED" || !await deps.authorize(actor))
        throw onboardingDenied();
      const command = onboardingApprovalSchema.safeParse(input);
      if (!command.success)
        throw new ApplicationError("VALIDATION", "INVALID_REQUEST", "Invalid request.", false);
      return deps.approve(actor, command.data.id);
    },
  };
}
