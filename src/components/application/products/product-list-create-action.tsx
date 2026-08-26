export function ProductListCreateAction({
  href,
  label,
}: Readonly<{
  href: string | null;
  label: string;
}>) {
  if (href === null) return null;

  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
    >
      {label}
    </a>
  );
}
