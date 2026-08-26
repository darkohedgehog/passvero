import { getTranslations } from "next-intl/server";

export default async function ProductsLoading() {
  const t = await getTranslations("Products");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-slate-950">{t("loadingTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t("loadingDescription")}
        </p>
      </div>
    </main>
  );
}
