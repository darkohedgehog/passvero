import { getCreateProductHttpHandler } from "@/src/infrastructure/products/create-product-http-runtime";

export const POST = (request: Request) => getCreateProductHttpHandler()(request);
