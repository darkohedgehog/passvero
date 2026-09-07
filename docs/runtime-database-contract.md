# Production and staging database endpoint contract

`PASSVERO_RUNTIME_ENV` is the only deployment discriminator. Its exact values
are `production` and `staging`. It is required when composing runtime database
access: missing, padded, unknown or differently cased values fail closed.
There is no inferred/default environment and no fallback connection.

| Environment | Host | Port | Database | Business role | Auth role |
| --- | --- | --- | --- | --- | --- |
| production | 127.0.0.1 | 5432 | passvero | passvero_app | passvero_auth |
| staging | 127.0.0.1 | 5433 | passvero_acceptance | passvero_app | passvero_auth |

Runtime connection variables remain `DATABASE_URL` and `AUTH_DATABASE_URL`.
Both require direct PostgreSQL URLs, nonempty passwords, exact endpoint and
role identity, and no surrounding whitespace, query parameters or fragments.
Encoded role/database characters retain existing decoding behavior. No remote
hosts, localhost aliases, arbitrary ports, database names or role overrides are
supported. Staging port/name are fixed; there are no extra endpoint variables.

Before either staging pool can be constructed, both URLs must pass validation
against the staging endpoint. Mixed, missing or production-targeted staging
configuration is rejected. Passwords are not compared. Production keeps its
independent business/provider configuration lifecycle, but both validators
require the production endpoint.

This tightens the previous business validator, which checked role/database but
allowed other hosts/ports and did not require a password or prohibit all query
parameters. Auth endpoint strictness is preserved. Configuration errors expose
only fixed diagnostic categories, never candidate URLs or credentials.

Runtime environment access is server-only and lazy. `NODE_ENV` does not select
the Passvero environment: staging normally uses `NODE_ENV=production`. Static
verification builds need an explicit safe `BETTER_AUTH_URL`, but can leave
`PASSVERO_RUNTIME_ENV`, database URLs and all service credentials blank when no
runtime database access is composed. Unit-test injection and TEST_DATABASE_URL
harnesses stay separate; neither is a runtime fallback.

## Later operational requirements

The intended staging database is a separate PostgreSQL cluster with its own
storage, service identity, socket directory, credentials, ACLs and reset scope.
Matching role names across separate clusters do not mean shared credentials.
All staging passwords must be independent of production and supplied by the
operator. No runtime account receives migration privileges.

Prisma CLI configuration is unchanged: it reads its operator-supplied
DATABASE_URL and does not enforce this runtime discriminator or endpoint
validator. The staging migrator must independently target passvero_migrator at
127.0.0.1:5433/passvero_acceptance. Migration execution requires a separate gate
that verifies that target before connecting. Apply committed migration history
and role/ACL provisioning independently; production state is not staging proof.

Deploying this source later requires explicitly provisioning
PASSVERO_RUNTIME_ENV=production for production and staging for staging before
runtime start. Existing production configuration is not changed by this source
slice. There are no cluster, role, migration, deployment or reset commands here.
