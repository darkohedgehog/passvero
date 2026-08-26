import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AuthShell } from "@/src/components/application/auth/auth-shell";
import { VerificationPanel } from "@/src/components/application/auth/verification-panel";
import { isAppLocale } from "@/src/i18n/routing";

type PageProps = Readonly<{ params: Promise<{ locale: string }> }>;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Auth.verification" });
  return { title: t("metadataTitle"), description: t("metadataDescription"), robots: { index: false, follow: false } };
}

export default async function VerificationPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Auth" });
  return <AuthShell brandLabel={t("brand")} title={t("verification.title")} description={t("verification.description")}><VerificationPanel /></AuthShell>;
}
