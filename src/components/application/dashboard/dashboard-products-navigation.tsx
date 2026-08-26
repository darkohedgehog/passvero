import { Link } from "@/src/i18n/navigation";

export function DashboardProductsNavigation({
  productsLabel,
  organizationResolved,
}: Readonly<{
  productsLabel: string;
  organizationResolved: boolean;
}>) {
  if (!organizationResolved) {
    return null;
  }

  return (
    <nav aria-label={productsLabel} className="mt-4">
      <Link
        href="/dashboard/products"
        className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
      >
        {productsLabel}
      </Link>
    </nav>
  );
}
