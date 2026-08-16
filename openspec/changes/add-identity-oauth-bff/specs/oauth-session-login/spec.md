# oauth-session-login

## ADDED Requirements

### Requirement: OAuth authorization redirect

`GET /auth/oauth/start` MUST generate a PKCE `code_verifier`/
`code_challenge` pair and a CSRF `state` value, persist them server-side
keyed by a single-use nonce with a short TTL, and redirect the browser to
the active `IIdentityProvider`'s authorization endpoint via
`getAuthorizationUrl()`. This endpoint MUST only be reachable when
`OAUTH_SESSION_ENABLED` is `"true"`.

#### Scenario: Start redirects to the active provider

- **GIVEN** `OAUTH_SESSION_ENABLED=true` and a configured active provider
- **WHEN** a browser requests `GET /auth/oauth/start`
- **THEN** the response is a `302` redirect to the provider's authorization
  URL, carrying a `state` parameter and a PKCE `code_challenge`

#### Scenario: Disabled by default

- **GIVEN** `OAUTH_SESSION_ENABLED` is unset
- **WHEN** a request is made to `GET /auth/oauth/start`
- **THEN** the route MUST NOT be registered (`404`), and no other part of
  the application's behavior changes

### Requirement: OAuth callback and session creation

`GET /auth/oauth/callback` MUST validate the returned `state` against the
value stored for the matching nonce, reject the request if it does not
match or the stored entry has expired, and on success exchange the
authorization `code` for a token set via `exchangeAuthorizationCode()`.
The system MUST NOT return the provider's `accessToken`/`refreshToken` to
the browser in any form (response body, redirect URL, or non-`HttpOnly`
cookie).

#### Scenario: Valid callback creates a session

- **GIVEN** a valid `state` matching a pending `GET /auth/oauth/start`
  request and a valid authorization `code`
- **WHEN** `GET /auth/oauth/callback` is called
- **THEN** the system creates a server-side session record containing the
  provider's token set and the resolved `IPrincipal`, sets a single
  `HttpOnly`, `Secure`, `SameSite=Lax` cookie containing only an opaque
  session id, and redirects to `OAUTH_SUCCESS_REDIRECT_URL`

#### Scenario: State mismatch is rejected

- **GIVEN** a `state` value that does not match any pending, unexpired
  `GET /auth/oauth/start` request
- **WHEN** `GET /auth/oauth/callback` is called
- **THEN** the response MUST be `401 Unauthorized` and no session MUST be
  created

#### Scenario: Provider rejects the authorization code

- **GIVEN** a valid `state` but a `code` the provider rejects (expired,
  already used, or invalid)
- **WHEN** `GET /auth/oauth/callback` is called
- **THEN** the response MUST be `401 Unauthorized` and no session MUST be
  created

### Requirement: Session-based request authentication

`IdentityGuard` MUST resolve an `IPrincipal` from a valid session cookie
when one is present, before falling back to the `Authorization: Bearer`
header. Both resolution paths MUST attach the same `IPrincipal` shape to
the request, indistinguishable to `@CurrentUser()`/`RolesGuard`.

#### Scenario: Valid session cookie

- **GIVEN** a request carries a cookie referencing a valid, unexpired
  server-side session
- **WHEN** `IdentityGuard` processes the request
- **THEN** the request is allowed and the session's `IPrincipal` is
  attached to it, without requiring an `Authorization` header

#### Scenario: Session cookie takes precedence over a bearer token

- **GIVEN** a request carries both a valid session cookie and an
  `Authorization: Bearer` header
- **WHEN** `IdentityGuard` processes the request
- **THEN** the principal attached to the request MUST come from the
  session cookie

#### Scenario: No cookie falls back to bearer token

- **GIVEN** a request carries no session cookie but a valid
  `Authorization: Bearer` token
- **WHEN** `IdentityGuard` processes the request
- **THEN** the request is allowed via the existing bearer-token
  verification path, unchanged from `add-core-identity-module`

#### Scenario: Session not found

- **GIVEN** a request carries a cookie whose session id has no matching
  server-side record (expired or never existed)
- **WHEN** `IdentityGuard` processes the request
- **THEN** the guard MUST reject the request with `401 Unauthorized`

### Requirement: Silent token refresh

When a session's stored provider `accessToken` has expired,
`IdentityGuard` MUST transparently refresh it using the session's stored
`refreshToken` before attaching a principal, and MUST update the stored
session with the new token set. The caller MUST NOT need to call any
refresh endpoint for a cookie-based session.

#### Scenario: Expired access token is silently refreshed

- **GIVEN** a session whose stored `accessToken` has expired but whose
  `refreshToken` is still valid at the provider
- **WHEN** a request carrying that session's cookie is processed
- **THEN** `IdentityGuard` refreshes the token set against the active
  provider, updates the stored session, and allows the request — the
  response contains no indication a refresh occurred

#### Scenario: Refresh fails (revoked at the provider)

- **GIVEN** a session whose stored `accessToken` has expired and whose
  `refreshToken` the provider rejects (revoked, expired, or the account
  disabled)
- **WHEN** a request carrying that session's cookie is processed
- **THEN** the guard MUST destroy the stored session and reject the
  request with `401 Unauthorized`

### Requirement: Logout

`POST /auth/logout` MUST destroy the caller's server-side session record
and expire the session cookie. It MUST succeed (idempotently) even when
called with no session or an already-invalid one.

#### Scenario: Logout with an active session

- **GIVEN** a request carries a valid session cookie
- **WHEN** `POST /auth/logout` is called
- **THEN** the server-side session record is deleted and the response
  clears the cookie

#### Scenario: Logout with no session

- **GIVEN** a request carries no session cookie
- **WHEN** `POST /auth/logout` is called
- **THEN** the response MUST still succeed (no error), since the end
  state — no active session — is already satisfied

### Requirement: Existing bearer-token login is unaffected

The `POST /auth/login` and `POST /auth/refresh` endpoints from
`add-core-identity-module` MUST continue to behave exactly as before this
change, regardless of whether `OAUTH_SESSION_ENABLED` is set.

#### Scenario: Password login still works with OAuth session login enabled

- **GIVEN** `OAUTH_SESSION_ENABLED=true`
- **WHEN** `POST /auth/login` is called with valid credentials
- **THEN** the response is unchanged from `add-core-identity-module`'s
  behavior: `200 OK` with `accessToken`, `refreshToken`, `expiresIn` in the
  response body, no cookie set
