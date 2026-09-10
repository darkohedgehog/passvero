import type { ReactNode } from "react";
import type { ProductDetailSnapshot } from "@/src/application/products/get-product-detail/contracts";
import type { PublicDppLabels } from "@/src/components/public-dpp/public-dpp-document";

export function ProductDetailSnapshotContent({
  snapshot, sourceLocale, contentTitle, labels, cnSection, materialsSection,
}: Readonly<{
  snapshot: ProductDetailSnapshot;
  sourceLocale: string;
  contentTitle: string;
  labels: PublicDppLabels;
  cnSection?: ReactNode;
  materialsSection?: ReactNode;
}>) {
  const fields = [
    "shortDescription", "description", "technicalDescription", "repairInstructions",
    "sparePartsInformation", "recyclingInstructions", "disposalInstructions",
    "packagingInformation", "safetyInformation", "warrantyInformation", "publicNotes",
  ] as const;
  const populated = fields.filter((field) => snapshot.content[field]?.trim());
  return (
    <div className="mt-6 space-y-6">
      {populated.length === 0 ? null : (
        <div>
          <h4 className="text-base font-bold text-slate-950">{contentTitle}</h4>
          <dl className="mt-3 space-y-4">
            {populated.map((field) => (
              <div key={field}>
                <dt className="text-sm font-semibold text-slate-700">{labels[field]}</dt>
                <dd lang={sourceLocale} className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{snapshot.content[field]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {cnSection ?? (snapshot.cn === null ? null : (
        <div>
          <h4 className="text-base font-bold text-slate-950">{labels.cn}</h4>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-600">{labels.cnCode}</dt><dd className="font-mono text-sm font-semibold">{snapshot.cn.code}</dd></div>
            <div><dt className="text-sm text-slate-600">{labels.cnYear}</dt><dd className="text-sm font-semibold">{snapshot.cn.nomenclatureYear}</dd></div>
          </dl>
          <p className="mt-2 text-xs leading-5 text-slate-500">{labels.cnDisclaimer}</p>
        </div>
      ))}
      {materialsSection ?? (snapshot.materials.length === 0 ? null : (
        <div>
          <h4 className="text-base font-bold text-slate-950">{labels.materials}</h4>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {snapshot.materials.map((material, index) => (
              <li key={index} className="rounded-lg border border-slate-200 p-4">
                <p className="break-words font-semibold text-slate-900">{material.materialName}</p>
                <dl className="mt-2 space-y-2 text-sm">
                  {material.category === null ? null : <div><dt className="text-slate-600">{labels.category}</dt><dd className="break-words">{material.category}</dd></div>}
                  {material.percentage === null ? null : <div><dt className="text-slate-600">{labels.share}</dt><dd>{material.percentage}%</dd></div>}
                  <div><dt className="text-slate-600">{labels.recycledStatus}</dt><dd>{material.isRecycled ? labels.yes : labels.no}</dd></div>
                  {material.recycledPercentage === null ? null : <div><dt className="text-slate-600">{labels.recycledWithinMaterial}</dt><dd>{material.recycledPercentage}%</dd></div>}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
