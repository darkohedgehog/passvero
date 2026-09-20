import { toSVG } from "bwip-js/node";
import { gtinSchema, gtinSymbology } from "@/src/application/products/gtin/validation";

// Called only by server presentation; never send GTINs to a rendering service.
export function renderGtinBarcode(input: string) {
  const value = gtinSchema.parse(input);
  const svg = toSVG({ bcid: gtinSymbology(value), text: value, scale: 2,
    includetext: true, textxalign: "center", barcolor: "000000", backgroundcolor: "FFFFFF",
    // Additional white space beyond the renderer's symbol geometry, >= 11 modules.
    paddingwidth: 16, paddingheight: 8,
  });
  const dimensions = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!dimensions) throw new Error("Barcode dimensions unavailable");
  return { svg, width: Number(dimensions[1]), height: Number(dimensions[2]) };
}
