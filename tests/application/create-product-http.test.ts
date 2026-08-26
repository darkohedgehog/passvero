import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContextResolution } from "../../src/application/context/resolve-authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import type { CreateProduct } from "../../src/application/products/create-product/ports";
import {
  classifyCreateProductPageAccess,
  createCreateProductHttpHandler,
} from "../../src/application/products/create-product/create-product-http";

const canonicalOrigin = "https://passvero.eu";
const context = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "33333333-3333-4333-8333-333333333333",
  membershipRole: "EDITOR" as const,
  membershipStatus: "ACTIVE" as const,
  permissions: ["PRODUCT_READ", "PRODUCT_CREATE"] as const,
  correlationId: "server-correlation-id",
};

const resolved: AuthenticatedUserContextResolution = {
  status: "RESOLVED",
  context,
  presentation: { organizationName: "Organization A" },
};

function request(body: unknown, init: { origin?: string; method?: string; contentType?: string } = {}) {
  return new Request(`${canonicalOrigin}/api/products/create`, {
    method: init.method ?? "POST",
    headers: {
      origin: init.origin ?? canonicalOrigin,
      "content-type": init.contentType ?? "application/json",
    },
    body: init.method === "GET" ? undefined : JSON.stringify(body),
  });
}

function harness(input: {
  resolution?: AuthenticatedUserContextResolution;
  create?: CreateProduct;
} = {}) {
  const createCalls: Array<{
    command: Parameters<CreateProduct>[0];
    context: Parameters<CreateProduct>[1];
  }> = [];
  let resolutionCalls = 0;
  const create = input.create ?? (async (command, createContext) => {
    createCalls.push({ command, context: createContext });
    return {
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      initialProductVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      publicCode: "a".repeat(22),
      productStatus: "ACTIVE",
      draftStatus: "DRAFT",
      organizationSku: command.organizationSku ?? null,
      createdAt: new Date("2026-08-26T12:00:00.000Z"),
    };
  });
  const handler = createCreateProductHttpHandler({
    canonicalOrigin,
    async resolveContext() {
      resolutionCalls += 1;
      return input.resolution ?? resolved;
    },
    create,
  });
  return { createCalls, handler, get resolutionCalls() { return resolutionCalls; } };
}

test("accepts only the canonical command and returns no created identifiers", async () => {
  const fixture = harness();
  const response = await fixture.handler(request({
    initialProductName: "Industrial Chair",
    organizationSku: "CHAIR-1",
    initialLocale: "de",
  }));

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "CREATED" });
  assert.equal(fixture.resolutionCalls, 1);
  assert.deepEqual(fixture.createCalls, [{
    command: {
      initialProductName: "Industrial Chair",
      organizationSku: "CHAIR-1",
      initialLocale: "de",
    },
    context,
  }]);
});

test("rejects malformed and privileged payloads before context resolution", async () => {
  for (const body of [
    { initialProductName: "Chair", initialLocale: "en", organizationId: context.organizationId },
    { initialProductName: "Chair", initialLocale: "en", membershipId: context.membershipId },
    { initialProductName: "Chair", initialLocale: "en", role: "OWNER" },
    { initialProductName: "Chair", initialLocale: "en", permissions: ["PRODUCT_CREATE"] },
    { initialProductName: 7, initialLocale: "en" },
    { initialProductName: "Chair", initialLocale: "en", organizationSku: 7 },
  ]) {
    const fixture = harness();
    const response = await fixture.handler(request(body));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: "INVALID_REQUEST" });
    assert.equal(fixture.resolutionCalls, 0);
    assert.equal(fixture.createCalls.length, 0);
  }
});

test("requires same-origin POST JSON and a bounded request body", async () => {
  const cases = [
    request({ initialProductName: "Chair", initialLocale: "en" }, { method: "GET" }),
    request({ initialProductName: "Chair", initialLocale: "en" }, { origin: "https://attacker.example" }),
    request({ initialProductName: "Chair", initialLocale: "en" }, { contentType: "text/plain" }),
    request({ initialProductName: "x".repeat(4097), initialLocale: "en" }),
  ];
  for (const candidate of cases) {
    const fixture = harness();
    const response = await fixture.handler(candidate);
    assert.ok([400, 403].includes(response.status));
    assert.equal(fixture.resolutionCalls, 0);
  }
});

test("denies a direct VIEWER transport call before invoking CreateProduct", async () => {
  const fixture = harness({
    resolution: {
      ...resolved,
      context: {
        ...context,
        membershipRole: "VIEWER",
        permissions: ["PRODUCT_READ"],
      },
    },
  });
  const response = await fixture.handler(request({
    initialProductName: "Chair",
    initialLocale: "en",
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { status: "FORBIDDEN" });
  assert.equal(fixture.createCalls.length, 0);
});

test("maps canonical validation and SKU conflict errors to one safe field", async () => {
  for (const [error, expectedStatus, expectedField] of [
    [new ApplicationError("VALIDATION", "CREATE_PRODUCT_NAME_INVALID", "hidden", false), 400, "initialProductName"],
    [new ApplicationError("VALIDATION", "CREATE_PRODUCT_SKU_INVALID", "hidden", false), 400, "organizationSku"],
    [new ApplicationError("VALIDATION", "CREATE_PRODUCT_LOCALE_INVALID", "hidden", false), 400, "initialLocale"],
    [new ApplicationError("CONFLICT", "CREATE_PRODUCT_SKU_CONFLICT", "hidden", false), 409, "organizationSku"],
  ] as const) {
    const fixture = harness({ create: async () => { throw error; } });
    const response = await fixture.handler(request({
      initialProductName: "Chair",
      organizationSku: "CHAIR-1",
      initialLocale: "en",
    }));
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await response.json(), {
      status: "VALIDATION_ERROR",
      field: expectedField,
    });
  }
});

test("collapses tenant and internal failures without exposing application details", async () => {
  const denied = harness({
    resolution: { status: "DENIED", reason: "NO_ACTIVE_MEMBERSHIP" },
  });
  const deniedResponse = await denied.handler(request({
    initialProductName: "Chair",
    initialLocale: "en",
  }));
  assert.equal(deniedResponse.status, 403);
  assert.deepEqual(await deniedResponse.json(), { status: "FORBIDDEN" });

  const failed = harness({
    create: async () => {
      throw new Error("Prisma unique constraint organization secret");
    },
  });
  const failedResponse = await failed.handler(request({
    initialProductName: "Chair",
    initialLocale: "en",
  }));
  assert.equal(failedResponse.status, 503);
  const body = JSON.stringify(await failedResponse.json());
  assert.equal(body, '{"status":"OPERATIONAL_FAILURE"}');
  assert.doesNotMatch(body, /Prisma|constraint|organization/i);
});

test("classifies protected page access without treating selection or VIEWER as create authority", () => {
  assert.equal(classifyCreateProductPageAccess({ status: "DENIED", reason: "NO_PROVIDER_SESSION" }), "LOGIN");
  assert.equal(classifyCreateProductPageAccess({ status: "DENIED", reason: "IDENTITY_REVOKED" }), "LOGIN");
  assert.equal(classifyCreateProductPageAccess({ status: "DENIED", reason: "NO_ACTIVE_MEMBERSHIP" }), "DENIED");
  assert.equal(classifyCreateProductPageAccess({
    status: "ORGANIZATION_SELECTION_REQUIRED",
    currentUserId: context.userId,
    organizations: [],
  }), "ORGANIZATION_SELECTION_REQUIRED");
  assert.equal(classifyCreateProductPageAccess({
    ...resolved,
    context: { ...context, membershipRole: "VIEWER", permissions: ["PRODUCT_READ"] },
  }), "FORBIDDEN");
  assert.equal(classifyCreateProductPageAccess(resolved), "FORM");
});
