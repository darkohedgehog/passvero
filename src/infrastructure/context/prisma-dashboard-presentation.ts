interface DashboardPresentationPrismaClient {
  readonly user: {
    findUnique(input: {
      readonly where: { readonly id: string };
      readonly select: {
        readonly id: true;
        readonly email: true;
        readonly displayName: true;
      };
    }): Promise<{
      readonly id: string;
      readonly email: string;
      readonly displayName: string | null;
    } | null>;
  };
}

export class PrismaDashboardPresentation {
  constructor(private readonly prisma: DashboardPresentationPrismaClient) {}

  async findUserLabel(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });
    if (user === null) {
      return null;
    }
    return user.displayName?.trim() || user.email;
  }
}
