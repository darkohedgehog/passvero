# Dashboard UI language selector

The shared DashboardShell exposes the existing LanguageSwitcher beside sign-out
on dashboard home (including organization selection), Product list/detail/new,
and existing Product editing pages. There is no role or Product permission gate.

## Existing routing reused

Supported locales remain hr, sr, en, de, sl, pl. Croatian is canonical without a
prefix; other locales are prefixed. The request locale comes from next-intl
routing, with hr fallback. Automatic locale detection is disabled. Locale-aware
links preserve the selected URL locale; an explicit unprefixed URL still means hr.

The selector uses next-intl usePathname/useRouter.replace, preserving the actual
route and dynamic Product ID. next-intl updates its existing NEXT_LOCALE cookie
(SameSite=lax, path=/); this is not an auth cookie or a database preference. When
switching to hr, the library may navigate through /hr before middleware removes
the prefix. No custom locale-prefix manipulation or cookie writer is added.

DASHBOARD_LOCALE_PERSISTENCE=COOKIE_OR_EXISTING_ROUTING

User.preferredLocale exists but has no active application consumer and is not
written. Session identity, organization selection and permissions are unchanged.
The destination page continues using its existing protected resolution.

## Query handling

Marketing retains its existing path-only switching behavior. Dashboard switching
preserves only a single structurally valid Product list cursor on
/dashboard/products (v=1, UUID productId, canonical ISO updatedAt, canonical
base64url, at most 512 characters). Invalid/duplicate cursors, additional fields,
unknown queries, auth tokens and fragments are dropped. This navigation filter
does not replace the list service's own validation or tenant checks.

## UI and content boundary

The native select has existing localized Common.language/languages labels in all
six message files. Its selected option identifies the current locale. Dashboard
styling provides a 44px minimum height, visible focus and wrapping beside account
controls. Marketing's compact styling remains unchanged. Native keyboard, touch
and menu dismissal behavior is retained; the control is disabled during navigation.

Changing locale is navigation, not a Product mutation. Product sourceLocale,
translations, draft/published pointers, public availability, Passport and QR are
not submitted or written by this control. Public DPP locale/fallback is unchanged
and ignores NEXT_LOCALE. A German dashboard may display Croatian Product content.

The existing new-Product form initializes its source language from the route
locale and allows an explicit selection. That behavior is preserved. Switching
locale is route navigation; unsaved form inputs are not migrated between locales.
It never changes the source language of an existing Product.

No schema, migration, dependency, environment, API or auth changes. No database
proof or staging operation is required for this local UI slice. Actual staging
HR/EN/DE/mobile acceptance remains a separate phase after review and integration.
