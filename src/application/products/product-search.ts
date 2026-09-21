import { z } from "zod";

export const MAX_PRODUCT_SEARCH_LENGTH = 200;
export const productSearchSchema = z.string().max(MAX_PRODUCT_SEARCH_LENGTH).refine(value => !/[\u0000-\u001f\u007f]/.test(value)).transform(value => value.trim());
