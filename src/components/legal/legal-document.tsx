import { Link } from "@/src/i18n/navigation";
import { CONTACT_EMAIL, createMailtoHref } from "@/src/lib/site";

type LegalSection = {
  title: string;
  body: string;
};

type LegalDocumentProps = {
  title: string;
  intro: string;
  lastUpdated: string;
  lastUpdatedLabel: string;
  sections: readonly LegalSection[];
  backLabel: string;
  emailLabel: string;
  emailSubject: string;
};

export function LegalDocument({
  title,
  intro,
  lastUpdated,
  lastUpdatedLabel,
  sections,
  backLabel,
  emailLabel,
  emailSubject,
}: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-700 sm:px-6 md:py-20">
      <article className="mx-auto max-w-3xl rounded-[20px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 md:px-14 md:py-12">
        <Link
          href="/"
          className="inline-flex rounded-md text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
        >
          ← {backLabel}
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-[-0.035em] text-navy-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600">{intro}</p>
        <p className="mt-4 text-sm font-medium text-slate-500">
          {lastUpdatedLabel}: {lastUpdated}
        </p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-navy-950">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line text-base leading-7">{section.body}</p>
            </section>
          ))}
        </div>

        <a
          href={createMailtoHref(emailSubject)}
          className="mt-10 inline-flex rounded-md font-semibold text-blue-600 underline decoration-blue-200 underline-offset-4 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
        >
          {emailLabel}: {CONTACT_EMAIL}
        </a>
      </article>
    </main>
  );
}
