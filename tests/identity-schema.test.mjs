import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationsPath = new URL("../prisma/migrations/", import.meta.url);

function block(source, kind, name) {
  const match = source.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));

  assert.ok(match, `Missing ${kind} ${name}`);
  return match[1];
}

test("Identity Domain schema contains only the approved models and enums", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const enumNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);

  assert.deepEqual(modelNames, ["User", "Organization", "Membership", "Invitation"]);
  assert.deepEqual(enumNames, [
    "OrganizationStatus",
    "MembershipRole",
    "MembershipStatus",
    "InvitationStatus",
  ]);

  for (const modelName of modelNames) {
    assert.match(
      block(schema, "model", modelName),
      /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/,
      `${modelName} must use a UUID primary key`,
    );
  }
});

test("Identity Domain schema encodes approved relations and uniqueness", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const user = block(schema, "model", "User");
  const organization = block(schema, "model", "Organization");
  const membership = block(schema, "model", "Membership");
  const invitation = block(schema, "model", "Invitation");

  assert.match(user, /email\s+String\s+@unique/);
  assert.match(organization, /slug\s+String\?\s+@unique/);
  assert.match(organization, /status\s+OrganizationStatus\s+@default\(ACTIVE\)/);
  assert.match(membership, /status\s+MembershipStatus\s+@default\(ACTIVE\)/);
  assert.match(invitation, /status\s+InvitationStatus\s+@default\(PENDING\)/);
  assert.match(invitation, /tokenHash\s+String\s+@unique/);
  assert.match(membership, /@@unique\(\[organizationId, userId\]\)/);

  assert.match(
    membership,
    /organization\s+Organization\s+@relation\("OrganizationMemberships", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    membership,
    /user\s+User\s+@relation\("UserMemberships", fields: \[userId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    membership,
    /invitedBy\s+User\?\s+@relation\("MembershipsInvitedByUser", fields: \[invitedById\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(membership, /invitedById\s+String\?\s+@db\.Uuid/);

  assert.match(
    invitation,
    /organization\s+Organization\s+@relation\("OrganizationInvitations", fields: \[organizationId\], references: \[id\], onDelete: Restrict, onUpdate: Cascade\)/,
  );
  assert.match(
    invitation,
    /invitedBy\s+User\?\s+@relation\("OrganizationInvitationsCreated", fields: \[invitedById\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(
    invitation,
    /acceptedBy\s+User\?\s+@relation\("OrganizationInvitationsAccepted", fields: \[acceptedById\], references: \[id\], onDelete: SetNull, onUpdate: Cascade\)/,
  );
  assert.match(invitation, /invitedById\s+String\?\s+@db\.Uuid/);
  assert.match(invitation, /acceptedById\s+String\?\s+@db\.Uuid/);
});

test("initial migration includes the reviewed pending-invitation partial index", async () => {
  const migrationEntries = await readdir(migrationsPath, { withFileTypes: true });
  const migrationDirectories = migrationEntries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_init_identity_domain"))
    .map((entry) => entry.name);

  assert.equal(migrationDirectories.length, 1, "Expected one init_identity_domain migration");

  const migrationSql = await readFile(
    new URL(`${migrationDirectories[0]}/migration.sql`, migrationsPath),
    "utf8",
  );
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.match(migrationSql, /CREATE TYPE "InvitationStatus" AS ENUM \('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'\)/);
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "ux_invitation_one_pending_per_organization_email"\s+ON "Invitation" \("organizationId", lower\("email"\)\)\s+WHERE "status" = 'PENDING'::"InvitationStatus";/,
  );
  assert.doesNotMatch(
    migrationSql,
    /CREATE UNIQUE INDEX [^\n]+ ON "Invitation"\("organizationId", "email"\)/,
  );
});
