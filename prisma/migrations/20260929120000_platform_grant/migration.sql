-- No backfill: tenant roles never imply platform authority.
CREATE TABLE "PlatformGrant" (
    "userId" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "PlatformGrant_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "PlatformGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
