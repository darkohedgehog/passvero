export function ListPagination({ href, label }: { href: string | null; label: string }) {
  return href ? <nav aria-label={label} className="mt-6 flex justify-end"><a href={href} className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600">{label}</a></nav> : null;
}
