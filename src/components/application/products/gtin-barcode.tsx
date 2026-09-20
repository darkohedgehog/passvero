import { renderGtinBarcode } from "@/src/infrastructure/products/gtin-barcode";

export function GtinBarcode({ value, label }: { value: string; label: string }) {
  const image = renderGtinBarcode(value);
  return <figure style={{ margin: 0, maxWidth: "100%" }}>
    {/* Local inline SVG is self-contained; Next image optimization is unnecessary. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:image/svg+xml;base64,${Buffer.from(image.svg).toString("base64")}`} alt={`${label}: ${value}`} width={image.width} height={image.height} style={{ display: "block", maxWidth: "100%", height: "auto", background: "#fff" }} />
    <figcaption style={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{value}</figcaption>
  </figure>;
}
