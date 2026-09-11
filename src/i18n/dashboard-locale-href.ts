// Only the existing list pagination payload is safe to carry across UI locales.
// This is navigation filtering; the list service still validates its own input.
export function dashboardLocaleHref(pathname: string, search: string): string {
  if (pathname !== "/dashboard/products") return pathname;
  const values = new URLSearchParams(search).getAll("cursor");
  if (values.length !== 1) return pathname;
  const cursor = values[0];
  if (!cursor || cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return pathname;
  try {
    const decoded = atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
    if (btoa(decoded).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") !== cursor) return pathname;
    const value: unknown = JSON.parse(decoded);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return pathname;
    const payload = value as Record<string, unknown>;
    if (Object.keys(payload).length !== 3 || payload.v !== 1
      || typeof payload.productId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.productId)
      || typeof payload.updatedAt !== "string") return pathname;
    const date = new Date(payload.updatedAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== payload.updatedAt) return pathname;
    return `${pathname}?${new URLSearchParams({ cursor })}`;
  } catch {
    return pathname;
  }
}
