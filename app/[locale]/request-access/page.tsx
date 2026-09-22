import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { RequestAccessForm } from "@/src/components/application/auth/request-access-form";
import { AuthShell } from "@/src/components/application/auth/auth-shell";
import { isAppLocale } from "@/src/i18n/routing";

type Props = Readonly<{ params: Promise<{ locale: string }> }>;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "RequestAccess" });
  return { title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}
export default async function RequestAccessPage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "RequestAccess" });
  return <AuthShell brandLabel="Passvero" title={t("title")} description={t("description")}><RequestAccessForm /></AuthShell>;
}
