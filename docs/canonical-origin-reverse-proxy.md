# Canonical origin and trusted single proxy

`BETTER_AUTH_URL` is the sole canonical application origin for auth links,
publication/QR targets and application metadata. It must be an explicit HTTPS
root origin without credentials, a nondefault port, query or fragment. Explicit
`:443` is normalized. Missing/invalid configuration has no production fallback.

Static metadata builds require the intended deployment origin. Verification
builds may use `https://passvero.invalid` with DB, SMTP, Better Auth, activation,
abuse, Turnstile and proxy credentials blank. This is service-secret-free, not
origin-free. Build separately for each origin and verify generated metadata
against runtime configuration before deployment.

## Protected request boundary

Protected auth, Organization-selection and existing origin-sensitive Product
mutations require `PASSVERO_TRUSTED_PROXY_SECRET`. This is canonical unpadded
base64url encoding of exactly 32 cryptographically random bytes, independently
managed per environment and separate from every other credential. The source
slice does not generate it or configure a proxy.

The sole trusted proxy must overwrite client-supplied copies and emit one exact
value for each upstream header:

| Header | Value |
| --- | --- |
| Host | Configured canonical hostname, without a port |
| X-Forwarded-Host | Same canonical hostname |
| X-Forwarded-Proto | `https` |
| X-Forwarded-Port | `443` |
| X-Passvero-Proxy-Token | Dedicated proxy credential |

No comma lists, alternate/trailing-dot hosts or proxy chains are accepted.
The proxy must reject/normalize raw duplicates that Node's parsed Headers cannot
identify. Overwrite/remove unsupported inbound forwarding metadata. Preserve
the browser's actual Origin; never substitute the expected Origin.

The backend must remain externally inaccessible, with a loopback listener and
one trusted proxy entry point. The credential proves possession, not process
identity; host processes able to read it are inside this trust boundary.

Mutation requests require exact browser Origin equality. Verification consume
GET permits absent Origin, but any supplied Origin must match. Both require
proxy provenance before body/token/provider/business operations. Internal
request.url is used for route/query parsing, not external-origin authority.
There is no direct-backend, development, localhost or health-check bypass.

Invalid evidence yields existing generic denial categories. Missing/malformed
proxy configuration yields sanitized operational failure. The proxy verifier
is lazy and is not needed by static metadata builds or anonymous Public DPP.

Never log, return, audit or expose the proxy credential to clients. Provider-
facing header copies remove X-Passvero-Proxy-Token, including session reads,
sign-in/out and password-change/revocation calls.

## Later deployment proof

Deployment/configuration remain separately gated. Through the configured proxy,
POST an empty JSON object to sign-in with the canonical browser Origin: expect
400 INVALID_REQUEST. Wrong Origin or direct-backend traffic without the proxy
credential must be denied. Verification GET with valid proxy evidence and no
token must reach existing token validation without consuming any token.

No account creation, email, real token, database write or login is part of this
proof. Production/staging metadata, frontend assets and deployment configuration
must be checked before opening manual acceptance.

Runtime database access additionally requires the explicit deployment
discriminator and fixed endpoint rules in [Runtime database contract](runtime-database-contract.md).
