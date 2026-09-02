/* eslint-disable @next/next/no-head-element -- This route handler renders a complete server-only HTML document so it can return exact 404/410/503 statuses. */
import type { ReactNode } from "react";

import type {
  GetPublicDppResult,
  PublicDpp,
  PublicDppLocale,
} from "@/src/application/public-dpp/contracts";

export interface PublicDppLabels {
  readonly documentTitle: string;
  readonly active: string;
  readonly organization: string;
  readonly version: string;
  readonly published: string;
  readonly language: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly technicalDescription: string;
  readonly repairInstructions: string;
  readonly sparePartsInformation: string;
  readonly recyclingInstructions: string;
  readonly disposalInstructions: string;
  readonly packagingInformation: string;
  readonly safetyInformation: string;
  readonly warrantyInformation: string;
  readonly publicNotes: string;
  readonly materials: string;
  readonly category: string;
  readonly share: string;
  readonly recycledStatus: string;
  readonly recycledWithinMaterial: string;
  readonly yes: string;
  readonly no: string;
  readonly cn: string;
  readonly cnCode: string;
  readonly cnYear: string;
  readonly cnDisclaimer: string;
  readonly withdrawnTitle: string;
  readonly withdrawnMessage: string;
  readonly notFoundTitle: string;
  readonly notFoundMessage: string;
  readonly unavailableTitle: string;
  readonly unavailableMessage: string;
  readonly metadataDescription: string;
  readonly languageNames: Readonly<Record<PublicDppLocale, string>>;
}

interface PublicDppDocumentProps {
  readonly result: GetPublicDppResult;
  readonly locale: PublicDppLocale;
  readonly labels: PublicDppLabels;
  readonly canonicalUrl: string;
  readonly publicCode: string;
}

export function PublicDppDocument({ result, locale, labels, canonicalUrl, publicCode }: PublicDppDocumentProps) {
  const title = result.kind === "PUBLIC"
    ? `${result.dpp.content.productName} | ${labels.documentTitle} | Passvero`
    : stateTitle(result, labels);
  const description = result.kind === "PUBLIC"
    ? labels.metadataDescription.replace("{productName}", result.dpp.content.productName)
    : stateDescription(result, labels);
  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href={canonicalUrl} />
        <style>{PUBLIC_DPP_CSS}</style>
      </head>
      <body>
        {result.kind === "PUBLIC" ? (
          <PublicDppView dpp={result.dpp} publicCode={publicCode} labels={labels} />
        ) : (
          <StateView result={result} labels={labels} />
        )}
      </body>
    </html>
  );
}

function PublicDppView({ dpp, publicCode, labels }: { readonly dpp: PublicDpp; readonly publicCode: string; readonly labels: PublicDppLabels }) {
  const contentSections: ReadonlyArray<readonly [string, string | null]> = [
    [labels.shortDescription, dpp.content.shortDescription],
    [labels.description, dpp.content.description],
    [labels.technicalDescription, dpp.content.technicalDescription],
    [labels.repairInstructions, dpp.content.repairInstructions],
    [labels.sparePartsInformation, dpp.content.sparePartsInformation],
    [labels.recyclingInstructions, dpp.content.recyclingInstructions],
    [labels.disposalInstructions, dpp.content.disposalInstructions],
    [labels.packagingInformation, dpp.content.packagingInformation],
    [labels.safetyInformation, dpp.content.safetyInformation],
    [labels.warrantyInformation, dpp.content.warrantyInformation],
    [labels.publicNotes, dpp.content.publicNotes],
  ];
  return (
    <main lang={dpp.locale}>
      <header className="hero">
        <div className="brand">Passvero</div>
        <p className="eyebrow">{labels.documentTitle}</p>
        <h1>{dpp.content.productName}</h1>
        <p className="status"><span aria-hidden="true" />{labels.active}</p>
      </header>

      {dpp.availableLocales.length > 1 ? (
        <nav className="languages" aria-label={labels.language}>
          {dpp.availableLocales.map((locale) => (
            <a key={locale} href={`/p/${publicCode}?lang=${locale}`} aria-current={locale === dpp.locale ? "page" : undefined}>
              {labels.languageNames[locale]}
            </a>
          ))}
        </nav>
      ) : null}

      <section aria-labelledby="identity-heading">
        <h2 id="identity-heading">{labels.organization}</h2>
        <p>{dpp.organization.displayName}</p>
        <dl className="facts">
          <div><dt>{labels.version}</dt><dd>{dpp.version.number}</dd></div>
          <div><dt>{labels.published}</dt><dd>{formatDate(dpp.version.publishedAt, dpp.locale)}</dd></div>
        </dl>
      </section>

      {contentSections.map(([heading, value]) => present(value) ? (
        <section key={heading}>
          <h2>{heading}</h2>
          <p className="authored">{value}</p>
        </section>
      ) : null)}

      {dpp.materials.length > 0 ? (
        <section aria-labelledby="materials-heading">
          <h2 id="materials-heading">{labels.materials}</h2>
          <ul className="materials">
            {dpp.materials.map((material, index) => (
              <li key={`${material.materialName}-${index}`}>
                <h3>{material.materialName}</h3>
                <dl className="material-facts">
                  {present(material.category) ? <Fact label={labels.category}>{material.category}</Fact> : null}
                  {material.percentage !== null ? <Fact label={labels.share}>{`${material.percentage}%`}</Fact> : null}
                  <Fact label={labels.recycledStatus}>{material.isRecycled ? labels.yes : labels.no}</Fact>
                  {material.recycledPercentage !== null ? <Fact label={labels.recycledWithinMaterial}>{`${material.recycledPercentage}%`}</Fact> : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dpp.cn !== null ? (
        <section aria-labelledby="cn-heading">
          <h2 id="cn-heading">{labels.cn}</h2>
          <dl className="facts">
            <Fact label={labels.cnCode}><code>{groupCn(dpp.cn.code)}</code></Fact>
            <Fact label={labels.cnYear}>{dpp.cn.nomenclatureYear}</Fact>
          </dl>
          <p className="disclaimer">{labels.cnDisclaimer}</p>
        </section>
      ) : null}
    </main>
  );
}

function StateView({ result, labels }: { readonly result: Exclude<GetPublicDppResult, { kind: "PUBLIC" }>; readonly labels: PublicDppLabels }) {
  const title = stateTitle(result, labels);
  return (
    <main className="state">
      <div className="brand">Passvero</div>
      <p className="eyebrow">{labels.documentTitle}</p>
      <h1>{title}</h1>
      <p>{stateDescription(result, labels)}</p>
      {result.kind === "WITHDRAWN" && result.publicMessage !== null ? <p className="public-message">{result.publicMessage}</p> : null}
    </main>
  );
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function stateTitle(result: Exclude<GetPublicDppResult, { kind: "PUBLIC" }>, labels: PublicDppLabels) {
  if (result.kind === "WITHDRAWN") return labels.withdrawnTitle;
  return result.kind === "NOT_FOUND" ? labels.notFoundTitle : labels.unavailableTitle;
}

function stateDescription(result: Exclude<GetPublicDppResult, { kind: "PUBLIC" }>, labels: PublicDppLabels) {
  if (result.kind === "WITHDRAWN") return labels.withdrawnMessage;
  return result.kind === "NOT_FOUND" ? labels.notFoundMessage : labels.unavailableMessage;
}

function present(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function groupCn(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4, 6)} ${code.slice(6, 8)}`;
}

function formatDate(value: string, locale: PublicDppLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

const PUBLIC_DPP_CSS = `
:root{color-scheme:light;font-family:Geist,Inter,ui-sans-serif,system-ui,sans-serif;color:#0f172a;background:#f8fafc}
*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a}main{width:min(100% - 2rem,48rem);margin:0 auto;padding:2rem 0 4rem;overflow-wrap:anywhere}
.hero,.state{padding:1.5rem;border:1px solid #e2e8f0;border-radius:1rem;background:#fff}.state{margin-top:2rem}.brand{font-weight:800;color:#0f766e;letter-spacing:.02em}.eyebrow{margin:1rem 0 .35rem;color:#475569;font-size:.875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
h1{margin:.25rem 0;font-size:clamp(1.75rem,8vw,2.75rem);line-height:1.12}h2{margin:0 0 1rem;font-size:1.35rem}h3{margin:0 0 .75rem;font-size:1.1rem}p,dd{font-size:1rem;line-height:1.65}.status{display:flex;align-items:center;gap:.5rem;margin:1rem 0 0;font-weight:700}.status span{width:.75rem;height:.75rem;border-radius:999px;background:#0f9f91}
.languages{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}.languages a{display:inline-flex;min-height:2.75rem;align-items:center;padding:.55rem .9rem;border:1px solid #cbd5e1;border-radius:.75rem;color:#123047;text-decoration:none;background:#fff;font-weight:650}.languages a[aria-current=page]{border-color:#0f766e;background:#ecfdf5}.languages a:focus-visible{outline:3px solid #3b82f6;outline-offset:3px}
section{margin-top:1rem;padding:1.25rem;border:1px solid #e2e8f0;border-radius:1rem;background:#fff}.facts,.material-facts{display:grid;gap:1rem;margin:0}.facts div,.material-facts div{min-width:0}dt{color:#64748b;font-size:.875rem;font-weight:650}dd{margin:.15rem 0 0;font-weight:650}.authored{margin:0;white-space:pre-line}.materials{display:grid;gap:1rem;margin:0;padding:0;list-style:none}.materials li{padding:1rem;border-radius:.75rem;background:#f8fafc}.disclaimer{margin:1rem 0 0;color:#475569;font-size:.875rem}.public-message{padding:1rem;border-radius:.75rem;background:#f1f5f9;font-weight:650}code{font-size:1rem;white-space:nowrap}
@media(min-width:40rem){main{padding-top:3rem}.hero,section,.state{padding:2rem}.facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;
