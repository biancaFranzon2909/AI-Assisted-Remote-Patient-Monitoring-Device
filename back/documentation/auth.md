# Authentication Overview
TODO: passar para o readme

This document explains how authentication works, which tokens are used, and how env variables affect the flow.

## Tokens and Cookies

- Access token: JWT stored in the `_tk` cookie.
- Refresh token: opaque random string stored in the `_rtk` cookie and in the database (hashed).

Cookie settings:
- `httpOnly: true` to block JS access.
- `secure: true` only in production.
- `sameSite: "none"` in production and `"lax"` otherwise.

## Login Flow (`authenticate`)

1. Validates `nome_usuario` and `senha`.
2. Looks up the user by `nome_usuario` or `email`.
3. Verifies the password with Argon2.
4. Signs a JWT access token.
5. Creates a refresh token (random 32 bytes, base64url) and stores its SHA-256 hash in `tokens`.
6. Sets `_tk` and `_rtk` cookies.

Stored refresh token data (table `tokens`):
- `token_hash`: SHA-256 of the refresh token value.
- `device_info`: user-agent string (if available).
- `ip_address`: request IP.
- `expires_at`: database expiry for refresh token.
- `revoked_at`: set when rotated or logged out.

## Refresh Flow (`refreshToken`)

1. Reads `_rtk` from cookies.
2. Hashes it and searches a token record where:
   - `token_hash` matches
   - `revoked_at` is null
   - `expires_at` is in the future
3. Loads the user and validates `is_active`.
4. Rotates the refresh token:
   - Revokes the old one (sets `revoked_at`).
   - Creates a new refresh token record.
5. Signs a new access token and reissues cookies.

## Logout Flow (`logout`)

1. Reads `_rtk` from cookies.
2. If present, revokes it in the database (sets `revoked_at`).
3. Clears both cookies.

## Access Validation (Middleware)

- Reads the `_tk` cookie and verifies the JWT with `JWT_SECRET`.
- Requires `type: "access"` and a nonempty `usuario_id`, then adds the identity to `req.user`.
- Invitation preview accepts an optional session; invalid or expired sessions are treated as signed out.
- Invitation acceptance, `/auth/me` and `/empresas/create` require authentication but no selected company.
- Other protected endpoints require `x-workspace-id` and membership in that company before setting `req.user.empresaId`.

## Invitation Flow

`GET /convite/aceite/:token` is the link opened from the email. It validates the signed invitation, its expiry, the company and the recipient:

- Missing recipient: redirects to `/register` with `isNewUser=true`.
- Active recipient without a matching session: redirects to `/login` with `isNewUser=false`.
- Active recipient with a matching session: accepts the invitation and redirects to `/` only after success.
- Both registration and login redirects contain URL-encoded `email`, `nome`, `idd` and `tk` parameters. These parameters guide the UI; only the signed token authorizes acceptance.
- Expected errors redirect to `/login` with one flag set to `true`: `inviteInvalid`, `inviteExpired`, `inviteUnavailable` or `accountInactive`.
- Unexpected database/server failures return HTTP 500, without a success redirect.

After registration and login, the frontend must call `POST /convite/aceitar/:token`, using the preserved `tk` and the authenticated cookie (`credentials: "include"` for cross-origin requests). Registration only creates the account. If another account is signed in, the UI must allow switching to the invited account.

The POST revalidates the invitation and requires the authenticated user to be its active recipient. It returns HTTP 200 on acceptance, including repeated acceptance of an existing membership without changing its role. Expected errors return `{ error: true, code, message }`:

| Code | HTTP status |
| --- | --- |
| `inviteInvalid` | 400 |
| `inviteExpired` | 400 |
| `inviteUnavailable` | 404 |
| `accountInactive` | 403 |
| `inviteAccountMismatch` | 403 |

Missing or invalid authentication returns HTTP 401. The frontend must navigate to the dashboard only after successful acceptance and handle invitations that expire during registration/login. The invitation lifetime remains **20 seconds intentionally for testing**.

Automatic acceptance on GET is retained as a product rule. It mutates membership on link navigation; a future confirmation flow could restrict mutations to POST. Invitation tokens are bearer credentials: avoid logging URLs containing them. Preview responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`; the frontend should remove the token from the visible URL after capturing it.

Run the focused tests with `node --test tests/convite.test.cjs`. They exercise the HTTP flow with a mocked database; they do not send email or validate a real database/frontend integration.

## Env Variables (Auth)

- `JWT_SECRET`
  - Secret used to sign and verify access tokens.
- `ACCESS_TOKEN_EXPIRES_IN`
  - Access token lifetime (JWT `expiresIn` and `_tk` cookie `maxAge`).
  - Supports `s`, `m`, `h`, `d` suffix (e.g., `15m`, `6h`).
- `REFRESH_TOKEN_TTL_DAYS`
  - Refresh token lifetime in days.
  - Used for database `expires_at` and `_rtk` cookie `maxAge`.
- `NODE_ENV`
  - When `production`, cookies are set with `secure: true`.

## Summary of TTL Mapping

- `_tk` (access token): `ACCESS_TOKEN_EXPIRES_IN`
- `_rtk` (refresh token): `REFRESH_TOKEN_TTL_DAYS`
- tokens table `expires_at`: `REFRESH_TOKEN_TTL_DAYS`
