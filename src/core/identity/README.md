# Identity

A provider-agnostic identity bridge — not a bounded context. It persists
nothing of its own; the external identity provider (Cognito, Supabase, or
any OIDC-compliant IdP) is always the source of truth for users. Inert by
default: unless `IDENTITY_PROVIDER` is set, this module isn't even imported
into `CoreModule` and nothing about the app's behavior changes.

## Enabling it

Set `IDENTITY_PROVIDER` to one of `cognito`, `supabase`, or `oidc`, plus
that provider's required vars (see `.env.example`):

| Provider   | Required vars                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `cognito`  | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`                                           |
| `supabase` | `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`                                      |
| `oidc`     | `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (optional `OIDC_ROLE_CLAIM`, default `roles`) |

Missing vars for the selected provider fail application boot (see
`src/core/config/env.validation.ts`), before the HTTP server starts
listening. Only one provider is active per deployment.

## What it provides

- **`POST /auth/login`, `POST /auth/refresh`** (`AuthController`) — backend-
  proxied login/refresh against the active provider. Credentials are
  forwarded straight through and never logged or persisted; only the
  submitted email is logged on entry.
- **`IdentityGuard`** — verifies the `Authorization: Bearer <token>` header
  against the active provider and attaches a normalized `IPrincipal`
  (`sub`, `email`, `roles`, `tenantIds`) to the request. `tenantIds` is every
  tenant the principal is a verified member of (an empty array means no
  tenant membership) — see `src/core/tenancy/README.md` for how a request
  picks one of them via the `X-Tenant-Id` header. Works for REST and
  GraphQL.
- **`RolesGuard` + `@Roles(...)`** — enforces role metadata against the
  attached principal. Run after `IdentityGuard`:
  `@UseGuards(IdentityGuard, RolesGuard)`.
- **`@CurrentUser()`** — extracts the attached `IPrincipal` in a
  handler/resolver.
- **MCP**: `core.module.ts` passes `IdentityMcpContextBuilder` to
  `McpModule.forRoot({ contextBuilder })` when enabled, so MCP tools can
  read the same `IPrincipal` off `IMcpToolContext.principal` (present only
  when the request carried a valid bearer token — a missing/invalid token
  never rejects an MCP request at the context-builder level).

None of the guards are applied globally — importing this module never
starts requiring auth on existing routes. Apply `IdentityGuard`/`RolesGuard`
explicitly on whichever controllers/resolvers a service adds.

```ts
@UseGuards(IdentityGuard, RolesGuard)
@Roles(Role.ADMIN)
@Get('admin-only')
adminOnly(@CurrentUser() user: IPrincipal) { ... }
```

## User management

`IIdentityProvider` also exposes `createUser`, `disableUser`, `deleteUser`,
`updateUserAttributes`, and `resetPassword`, all delegated straight to the
active provider's admin API (`@Inject(IDENTITY_PROVIDER)` to use them
directly). The generic OIDC adapter rejects all five — OIDC has no standard
admin API surface, so only Cognito and Supabase support user management.

Supabase has no native "disable" operation; `disableUser` bans the account
for a very long duration instead (documented inline in
`supabase-identity.provider.ts`).

## Structure

```
identity/
├── domain/enums/role.enum.ts              — shared Role enum
├── application/
│   ├── ports/                             — IIdentityProvider + IPrincipal/ITokenSet/etc.
│   └── services/identity-provider.factory.ts — resolves the active adapter from IDENTITY_PROVIDER
├── infrastructure/
│   ├── providers/{cognito,supabase,oidc}/ — one IIdentityProvider adapter each + its claims mapper
│   ├── guards/                            — IdentityGuard, RolesGuard
│   ├── decorators/                        — @CurrentUser(), @Roles()
│   └── mcp/                               — IdentityMcpContextBuilder
├── transport/rest/                        — AuthController + DTOs
└── identity.module.ts
```

`identity-provider.factory.ts` dynamically `import()`s only the selected
provider's adapter, so a service using Cognito never loads the Supabase or
OIDC SDKs (or vice versa) — see the comment in that file.

## Design notes / follow-ups

See `openspec/changes/add-core-identity-module/` for the full proposal,
design rationale (including sequence diagrams), and delta spec. Explicitly
out of scope for v1: rate limiting on `/auth/login`, multi-provider /
per-tenant selection, a local/dev fake provider, and persisting an
app-local user profile (would be its own bounded context, consuming
`IPrincipal.sub` as a foreign identifier).
