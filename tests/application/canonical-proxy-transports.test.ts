import assert from "node:assert/strict";
import test from "node:test";
import { createCreateProductHttpHandler } from "../../src/application/products/create-product/create-product-http";
import { createEditProductDraftHttpHandler } from "../../src/application/products/edit-product-draft/edit-product-draft-http";
import { createDraftTranslationContentHttpHandler } from "../../src/application/products/draft-translation-content/draft-translation-content-http";
import { createProductMaterialsHttpHandler } from "../../src/application/products/product-materials-current-draft/http";
import { createCnClassificationHttpHandler } from "../../src/application/products/cn-classification-current-draft/http";
import { createPublishProductHttpHandler } from "../../src/application/products/publish-product/http";
import { createProductQrHttpHandlers } from "../../src/application/products/qr/http";
import { createOrganizationSelectionHttpHandler } from "../../src/application/context/organization-selection-http";
import { createTrustedProxyVerifier } from "../../src/infrastructure/http/trusted-proxy";

const canonicalOrigin = "https://acceptance.example.test";
const token = Buffer.alloc(32, 9).toString("base64url");
const verifyProxy = createTrustedProxyVerifier(canonicalOrigin, token);
const unexpected = async (): Promise<never> => { assert.fail("Invalid requests must not reach context or domain operations"); };
const dependencies = { canonicalOrigin, verifyProxy, resolveContext: unexpected, create: unexpected,
  edit: unexpected, update: unexpected, add: unexpected, remove: unexpected, publish: unexpected,
  activate: unexpected, render: unexpected, select: unexpected };
const handlers = {
  create: createCreateProductHttpHandler(dependencies),
  edit: createEditProductDraftHttpHandler(dependencies),
  content: createDraftTranslationContentHttpHandler(dependencies),
  materials: createProductMaterialsHttpHandler(dependencies),
  cn: createCnClassificationHttpHandler(dependencies),
  publish: createPublishProductHttpHandler(dependencies),
  qr: createProductQrHttpHandlers(dependencies).activate,
  organization: createOrganizationSelectionHttpHandler(dependencies),
};
for (const [name, handle] of Object.entries(handlers)) {
  test(`${name}: authenticated proxy reaches validation; forged direct backend does not`, async () => {
    for (const mode of ["valid", "no-token", "wrong-origin", "no-origin"]) {
      const headers = new Headers({ host: "acceptance.example.test", "x-forwarded-host": "acceptance.example.test",
        "x-forwarded-proto": "https", "x-forwarded-port": "443", "x-passvero-proxy-token": token,
        origin: canonicalOrigin, "content-type": "application/json" });
      if (mode === "no-token") headers.delete("x-passvero-proxy-token");
      if (mode === "no-origin") headers.delete("origin");
      if (mode === "wrong-origin") headers.set("origin", "https://attacker.example.test");
      const response = await handle(new Request("http://127.0.0.1:3000/api/fixture", { method: "POST", headers, body: "{}" }), "fixture");
      assert.equal(response.status, mode === "valid" ? 400 : 403, mode);
      assert.ok(!(await response.text()).includes(token));
    }
  });
}
