# Testing and Verification

## Required checks

For most implementation tasks run:

```bash
npm run lint
npm run typecheck
npm run build
```

If `typecheck` does not exist:

```bash
npx tsc --noEmit
```

Run project tests when available:

```bash
npm run test
```

## Do not claim success without evidence

The final report must state:

- commands run;
- pass or fail status;
- relevant error output;
- checks not run and why.

## i18n verification

Verify:

```txt
/
/en
/de
/sr
/sl
/pl
```

Check:

- Croatian renders at `/`;
- locale prefixes work;
- unsupported locale returns 404;
- language switching preserves route;
- no duplicate `<html>` or `<body>`;
- no hydration warnings;
- all locale files share the same keys;
- server and client components receive locale correctly.

## Responsive verification

Test:

- 320 px;
- 375 px;
- 768 px;
- 1024 px;
- 1440 px.

Check for:

- horizontal scrolling;
- clipped text;
- overlapping buttons;
- inaccessible menus;
- unreadable form controls.

## Product authorization tests

When product management exists, test:

- user can read own organization product;
- user cannot read another organization product;
- user cannot update another organization product;
- invalid product ID returns not found or safe error;
- role permissions are enforced server-side.

## Passport publication tests

Test:

- draft passport is not publicly visible;
- published passport is visible;
- public page exposes only public fields;
- previous version remains preserved;
- invalid passport code returns 404;
- QR URL resolves correctly.

## Validation tests

Test:

- required fields;
- invalid enum values;
- overly long text;
- malformed URLs;
- invalid locale;
- unexpected fields;
- invalid file metadata.

## Build safety

A task is not complete when:

- lint fails;
- TypeScript fails;
- production build fails;
- runtime route errors are known;
- hydration warnings remain.

## Manual QA report

For UI tasks provide a short manual QA summary including:

- desktop route checked;
- mobile route checked;
- keyboard navigation checked;
- language switcher checked;
- known visual deviations.
