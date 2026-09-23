// Carry only supported catalog search and list pagination across UI locales.
// This is navigation filtering; the list service still validates its own input.
export function dashboardLocaleHref(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  if (pathname === "/dashboard/dpp") {
    const cursors = params.getAll("cursor");
    return cursors.length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursors[0])
      ? `${pathname}?${new URLSearchParams({cursor:cursors[0]})}` : pathname;
  }
  if (pathname === "/dashboard/products") {
    const queries = params.getAll("q");
    const query = queries.length === 1 && queries[0].length <= 200 && !/[\u0000-\u001f\u007f]/.test(queries[0]) ? queries[0].trim() : "";
    const base = query ? `${pathname}?${new URLSearchParams({q:query})}` : pathname;
    const cursor = catalogCursor(params, Boolean(query));
    return cursor ? `${base}${query ? "&" : "?"}${new URLSearchParams({cursor})}` : base;
  }
  return pathname;
}
function catalogCursor(params: URLSearchParams, search: boolean): string | null {
  const values = params.getAll("cursor");
  if (values.length !== 1) return null;
  const cursor = values[0];
  if (!cursor || cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  try {
    const decoded = atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
    if (btoa(decoded).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") !== cursor) return null;
    const value: unknown = JSON.parse(decoded);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const payload = value as Record<string, unknown>;
    if (Object.keys(payload).length !== (search ? 4 : 3) || payload.v !== (search ? 2 : 1)
      || (search && (typeof payload.searchHash !== "string" || !/^[a-f0-9]{64}$/.test(payload.searchHash)))
      || typeof payload.productId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.productId)
      || typeof payload.updatedAt !== "string") return null;
    const date = new Date(payload.updatedAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== payload.updatedAt) return null;
    return cursor;
  } catch {
    return null;
  }
}
