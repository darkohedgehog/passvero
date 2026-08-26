import type {
  AuthenticatedIdentity,
  CurrentUserResolution,
  CurrentUserResolutionFailure,
} from "@/src/application/auth/resolve-current-user";
import type {
  AuthenticatedUserContext,
  MembershipRole,
  MembershipStatus,
} from "@/src/application/context/authenticated-user-context";
import { permissionsForMembershipRole } from "@/src/application/permissions/product-permissions";

export type OrganizationStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "DEACTIVATED"
  | "PENDING_DELETION";

export interface TenantMembership {
  readonly membershipId: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipStatus: MembershipStatus;
  readonly membershipRole: MembershipRole;
  readonly organizationStatus: OrganizationStatus | null;
  readonly organizationDisplayName: string;
}

interface SessionSelector {
  readonly provider: AuthenticatedIdentity["provider"];
  readonly providerSessionId: string;
}

export interface OrganizationContextRepository {
  listMembershipsForUser(userId: string): Promise<readonly TenantMembership[]>;
  findSelection(selector: SessionSelector): Promise<{
    readonly selectedOrganizationId: string;
  } | null>;
  deleteSelection(selector: SessionSelector): Promise<void>;
  upsertSelection(input: SessionSelector & {
    readonly selectedOrganizationId: string;
  }): Promise<void>;
}

type TenantContextFailure =
  | CurrentUserResolutionFailure
  | "NO_ACTIVE_MEMBERSHIP"
  | "SELECTED_MEMBERSHIP_INVALID"
  | "ORGANIZATION_INACTIVE";

export type AuthenticatedUserContextResolution =
  | {
    readonly status: "RESOLVED";
    readonly context: AuthenticatedUserContext;
    readonly presentation: {
      readonly organizationName: string;
    };
  }
  | {
    readonly status: "ORGANIZATION_SELECTION_REQUIRED";
    readonly currentUserId: string;
    readonly organizations: readonly {
      readonly organizationId: string;
      readonly displayName: string;
    }[];
  }
  | { readonly status: "DENIED"; readonly reason: TenantContextFailure };

export type OrganizationSelectionResult =
  | { readonly status: "SELECTED" }
  | { readonly status: "DENIED"; readonly reason: TenantContextFailure };

interface Dependencies {
  readonly resolveCurrentUser: (
    identity: AuthenticatedIdentity | null,
  ) => Promise<CurrentUserResolution>;
  readonly repository: OrganizationContextRepository;
}

export function createAuthenticatedUserContextResolver(
  dependencies: Dependencies & { readonly correlationId: () => string },
) {
  return async (
    identity: AuthenticatedIdentity | null,
  ): Promise<AuthenticatedUserContextResolution> => {
    const currentUser = await dependencies.resolveCurrentUser(identity);
    if (currentUser.status !== "AUTHENTICATED") {
      return denied(currentUser.reason);
    }

    const selector = currentUser.providerSession;
    const memberships = await dependencies.repository.listMembershipsForUser(
      currentUser.currentUser.userId,
    );
    const selected = await dependencies.repository.findSelection(selector);
    const eligible = memberships.filter(
      (candidate) =>
        candidate.userId === currentUser.currentUser.userId
        && isEligible(candidate),
    );

    if (selected !== null) {
      const selectedMembership = memberships.find(
        (candidate) =>
          candidate.userId === currentUser.currentUser.userId
          && candidate.organizationId === selected.selectedOrganizationId,
      );

      if (!isEligible(selectedMembership)) {
        await dependencies.repository.deleteSelection(selector);
        if (eligible.length > 0) {
          return selectionRequired(currentUser.currentUser.userId, eligible);
        }
        if (
          selectedMembership !== undefined
          && selectedMembership.membershipStatus === "ACTIVE"
          && selectedMembership.organizationStatus !== null
          && selectedMembership.organizationStatus !== "ACTIVE"
        ) {
          return denied("ORGANIZATION_INACTIVE");
        }
        return denied("SELECTED_MEMBERSHIP_INVALID");
      }

      return resolved(
        currentUser.currentUser.userId,
        selectedMembership,
        dependencies.correlationId(),
      );
    }

    if (eligible.length === 0) {
      const hasInactiveOrganization = memberships.some(
        (candidate) =>
          candidate.userId === currentUser.currentUser.userId
          && candidate.membershipStatus === "ACTIVE"
          && candidate.organizationStatus !== null
          && candidate.organizationStatus !== "ACTIVE",
      );
      return denied(
        hasInactiveOrganization
          ? "ORGANIZATION_INACTIVE"
          : "NO_ACTIVE_MEMBERSHIP",
      );
    }

    if (eligible.length > 1) {
      return selectionRequired(currentUser.currentUser.userId, eligible);
    }

    const onlyMembership = eligible[0];
    await dependencies.repository.upsertSelection({
      ...selector,
      selectedOrganizationId: onlyMembership.organizationId,
    });
    return resolved(
      currentUser.currentUser.userId,
      onlyMembership,
      dependencies.correlationId(),
    );
  };
}

export function createOrganizationSelectionService(dependencies: Dependencies) {
  return async (
    identity: AuthenticatedIdentity | null,
    targetOrganizationId: string,
  ): Promise<OrganizationSelectionResult> => {
    const currentUser = await dependencies.resolveCurrentUser(identity);
    if (currentUser.status !== "AUTHENTICATED") {
      return denied(currentUser.reason);
    }

    const memberships = await dependencies.repository.listMembershipsForUser(
      currentUser.currentUser.userId,
    );
    const target = memberships.find(
      (candidate) =>
        candidate.userId === currentUser.currentUser.userId
        && candidate.organizationId === targetOrganizationId,
    );
    if (target === undefined || target.membershipStatus !== "ACTIVE") {
      return denied("SELECTED_MEMBERSHIP_INVALID");
    }
    if (target.organizationStatus !== "ACTIVE") {
      return denied(
        target.organizationStatus === null
          ? "SELECTED_MEMBERSHIP_INVALID"
          : "ORGANIZATION_INACTIVE",
      );
    }

    await dependencies.repository.upsertSelection({
      ...currentUser.providerSession,
      selectedOrganizationId: target.organizationId,
    });
    return { status: "SELECTED" };
  };
}

function isEligible(
  membership: TenantMembership | undefined,
): membership is TenantMembership & { readonly organizationStatus: "ACTIVE" } {
  return membership !== undefined
    && membership.membershipStatus === "ACTIVE"
    && membership.organizationStatus === "ACTIVE";
}

function resolved(
  userId: string,
  membership: TenantMembership,
  correlationId: string,
): AuthenticatedUserContextResolution {
  return {
    status: "RESOLVED",
    context: {
      userId,
      organizationId: membership.organizationId,
      membershipId: membership.membershipId,
      membershipRole: membership.membershipRole,
      membershipStatus: "ACTIVE",
      permissions: permissionsForMembershipRole(membership.membershipRole),
      correlationId,
    },
    presentation: {
      organizationName: membership.organizationDisplayName,
    },
  };
}

function selectionRequired(
  currentUserId: string,
  memberships: readonly TenantMembership[],
): AuthenticatedUserContextResolution {
  return {
    status: "ORGANIZATION_SELECTION_REQUIRED",
    currentUserId,
    organizations: memberships.map((membership) => ({
      organizationId: membership.organizationId,
      displayName: membership.organizationDisplayName,
    })),
  };
}

function denied(reason: TenantContextFailure) {
  return { status: "DENIED", reason } as const;
}
