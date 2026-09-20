import assert from "node:assert/strict";
import test from "node:test";
import { gtinSchema, equivalentGtin, gtinSymbology } from "../../src/application/products/gtin/validation";

// GS1 examples; not identifiers assigned to this application or its users.
const examples = [
  ["95200002", "ean8"], ["012345000058", "upca"],
  ["6291041500213", "ean13"], ["09520123456788", "itf14"],
] as const;
for (const [value, symbol] of examples) test(`preserves and validates ${value.length} digits`, () => {
  assert.equal(gtinSchema.parse(value), value);
  assert.equal(gtinSymbology(value), symbol);
  assert.equal(gtinSchema.safeParse(value.slice(0, -1) + ((Number(value.at(-1)) + 1) % 10)).success, false);
});
test("rejects non-ASCII digits, separators, unsupported lengths and all whitespace", () => {
  for (const value of ["", "1234567", "123456789", "12345678901", "123456789012345", " 012345000058", "012345000058\n", "012 345000058", "+012345000058", "０１２３４５００００５８", "01234500005x"]) {
    assert.equal(gtinSchema.safeParse(value).success, false, value);
  }
});
test("zero-padded representations compare equal without changing stored representation", () => {
  assert.equal(equivalentGtin("012345000058", "00012345000058"), true);
  assert.equal(equivalentGtin("95200002", "00000095200002"), true);
  assert.equal(equivalentGtin("012345000058", "6291041500213"), false);
});

test("commands require CAS and reject caller authority or issuing claims", async () => {
  const {gtinCommandSchema}=await import("../../src/application/products/gtin/contracts");
  const command={operation:"SET",value:"012345000058",expectedDraftVersionId:"00000000-0000-4000-8000-000000000001",expectedProductUpdatedAt:"2026-09-20T00:00:00.000Z",expectedDraftUpdatedAt:"2026-09-20T00:00:00.000Z"};
  assert.equal(gtinCommandSchema.safeParse(command).success,true);
  for(const extra of [{organizationId:command.expectedDraftVersionId},{issuingAuthority:"GS1 verified"},{notes:"private"},{expectedDraftVersionId:undefined},{expectedDraftUpdatedAt:undefined}])assert.equal(gtinCommandSchema.safeParse({...command,...extra}).success,false);
});
