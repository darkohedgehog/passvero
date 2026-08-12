import { randomBytes } from "node:crypto";

import type { ProductPublicCodeGenerator } from "@/src/application/products/create-product/public-code";

type ProductPublicCodeByteSource = (size: 16) => Buffer;

export class NodeProductPublicCodeGenerator implements ProductPublicCodeGenerator {
  constructor(
    private readonly byteSource: ProductPublicCodeByteSource = randomBytes,
  ) {}

  generate(): string {
    return this.byteSource(16).toString("base64url");
  }
}
