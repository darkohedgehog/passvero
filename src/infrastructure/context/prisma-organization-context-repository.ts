import type {
  OrganizationContextRepository,
  TenantMembership,
} from "@/src/application/context/resolve-authenticated-user-context";

interface OrganizationContextPrismaClient {
  readonly membership: {
    findMany(input: {
      readonly where: { readonly userId: string };
      readonly orderBy: { readonly id: "asc" };
      readonly select: {
        readonly id: true;
        readonly userId: true;
        readonly organizationId: true;
        readonly status: true;
        readonly role: true;
        readonly organization: {
          readonly select: {
            readonly status: true;
            readonly displayName: true;
          };
        };
      };
    }): Promise<readonly {
      readonly id: string;
      readonly userId: string;
      readonly organizationId: string;
      readonly status: TenantMembership["membershipStatus"];
      readonly role: TenantMembership["membershipRole"];
      readonly organization: {
        readonly status: Exclude<TenantMembership["organizationStatus"], null>;
        readonly displayName: string;
      };
    }[]>;
  };
  readonly authSessionSelection: {
    findUnique(input: {
      readonly where: {
        readonly provider_providerSessionId: SessionKey;
      };
      readonly select: { readonly selectedOrganizationId: true };
    }): Promise<{ readonly selectedOrganizationId: string } | null>;
    deleteMany(input: {
      readonly where: SessionKey;
    }): Promise<{ readonly count: number }>;
    upsert(input: {
      readonly where: {
        readonly provider_providerSessionId: SessionKey;
      };
      readonly create: SessionKey & { readonly selectedOrganizationId: string };
      readonly update: { readonly selectedOrganizationId: string };
      readonly select: { readonly id: true };
    }): Promise<{ readonly id: string }>;
  };
}

interface SessionKey {
  readonly provider: "BETTER_AUTH";
  readonly providerSessionId: string;
}

export class PrismaOrganizationContextRepository
implements OrganizationContextRepository {
  constructor(private readonly prisma: OrganizationContextPrismaClient) {}

  async listMembershipsForUser(
    userId: string,
  ): Promise<readonly TenantMembership[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        status: true,
        role: true,
        organization: { select: { status: true, displayName: true } },
      },
    });
    return memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      membershipStatus: membership.status,
      membershipRole: membership.role,
      organizationStatus: membership.organization.status,
      organizationDisplayName: membership.organization.displayName,
    }));
  }

  findSelection(selector: SessionKey) {
    return this.prisma.authSessionSelection.findUnique({
      where: { provider_providerSessionId: selector },
      select: { selectedOrganizationId: true },
    });
  }

  async deleteSelection(selector: SessionKey): Promise<void> {
    await this.prisma.authSessionSelection.deleteMany({ where: selector });
  }

  async upsertSelection(
    input: SessionKey & { readonly selectedOrganizationId: string },
  ): Promise<void> {
    await this.prisma.authSessionSelection.upsert({
      where: {
        provider_providerSessionId: {
          provider: input.provider,
          providerSessionId: input.providerSessionId,
        },
      },
      create: {
        provider: input.provider,
        providerSessionId: input.providerSessionId,
        selectedOrganizationId: input.selectedOrganizationId,
      },
      update: { selectedOrganizationId: input.selectedOrganizationId },
      select: { id: true },
    });
  }
}

export function createLazyOrganizationContextRepository(
  factory: () => OrganizationContextRepository,
): OrganizationContextRepository {
  let repository: OrganizationContextRepository | undefined;
  const getRepository = () => repository ??= factory();

  return {
    listMembershipsForUser: (userId) =>
      getRepository().listMembershipsForUser(userId),
    findSelection: (selector) => getRepository().findSelection(selector),
    deleteSelection: (selector) => getRepository().deleteSelection(selector),
    upsertSelection: (selection) =>
      getRepository().upsertSelection(selection),
  };
}
