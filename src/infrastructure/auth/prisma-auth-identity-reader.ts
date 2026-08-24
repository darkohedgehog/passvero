import type {
  AuthIdentityBinding,
  CurrentUserIdentityReader,
} from "@/src/application/auth/resolve-current-user";

interface AuthIdentityPrismaClient {
  readonly authIdentity: {
    findUnique(input: {
      readonly where: {
        readonly provider_providerSubject: {
          readonly provider: "BETTER_AUTH";
          readonly providerSubject: string;
        };
      };
      readonly select: {
        readonly userId: true;
        readonly revokedAt: true;
      };
    }): Promise<{
      readonly userId: string;
      readonly revokedAt: Date | null;
    } | null>;
  };
  readonly user: {
    findUnique(input: {
      readonly where: { readonly id: string };
      readonly select: { readonly id: true };
    }): Promise<{ readonly id: string } | null>;
  };
}

export class PrismaAuthIdentityReader implements CurrentUserIdentityReader {
  constructor(private readonly prisma: AuthIdentityPrismaClient) {}

  async findByProviderSubject(input: {
    readonly provider: "BETTER_AUTH";
    readonly providerSubject: string;
  }): Promise<AuthIdentityBinding | null> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: input.provider,
          providerSubject: input.providerSubject,
        },
      },
      select: { userId: true, revokedAt: true },
    });
    if (identity === null) {
      return null;
    }
    if (identity.revokedAt !== null) {
      return { revokedAt: identity.revokedAt, currentUser: null };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: identity.userId },
      select: { id: true },
    });

    return {
      revokedAt: null,
      currentUser: user === null ? null : { userId: user.id },
    };
  }
}
