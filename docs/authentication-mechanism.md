# How Authentication Works

The API uses an access token and a refresh token to keep users signed in across
the web app and browser extension. Passwords are stored as Argon2id hashes.

## Sign up and sign in

Send JSON containing `email` and `password` to:

| Route | Success | Common errors |
| --- | --- | --- |
| `POST /auth/sign-up` | `201 Created` | `400 Bad Request` for invalid input; `409 Conflict` when the email is already registered |
| `POST /auth/login` | `200 OK` | `400 Bad Request` for invalid input; `401 Unauthorized` for incorrect credentials |

Both successful responses contain a safe `user` object, an `accessToken`, and a
`refreshToken`. The response never includes the password or password hash. A
login response uses the same `401` message for an unknown email and an incorrect
password.

## Using access tokens

An access token is a signed JWT that expires after 15 minutes. Send it as a
Bearer token when calling an endpoint that requires authentication:

```http
Authorization: Bearer <accessToken>
```

The JWT payload contains an `exp` claim: the expiration time as Unix seconds.
Clients can decode that claim to schedule refreshes; decoding is only for
client-side timing and does not verify the token. The API remains responsible
for validating the signature and expiration.

## Refreshing tokens

Call `POST /auth/refresh` with the current refresh token:

```json
{
  "refreshToken": "<refreshToken>"
}
```

On success, the API returns `200 OK` with a new access token and a replacement
refresh token. Replace both saved tokens immediately and discard the old refresh
token. The API stores only a hash of refresh tokens. Refresh tokens expire after
30 days.

Refresh shortly before the access token's `exp` time, for example 60 seconds
before expiration, or immediately before a request when the remaining lifetime
is within that buffer. If a protected API request returns `401 Unauthorized`
because the access token expired, refresh once and retry that request once. If
refresh fails with `401`, the refresh token is invalid, expired, or revoked; ask
the user to sign in again. A missing `refreshToken` field returns `400 Bad
Request`.

Refresh tokens rotate on every successful refresh. Do not send simultaneous
refresh requests with the same token: reuse of a consumed token is treated as
possible theft and revokes the entire token family. Clients should share or
serialize refresh work across requests and tabs where possible.

## Logging out and token reuse

Call `POST /auth/logout` with the current refresh token to revoke its token
family:

```json
{
  "refreshToken": "<refreshToken>"
}
```

Logout responds with `204 No Content`. The request may omit the token, but then
the API cannot revoke a session. An access token already issued can remain valid
until it expires, for up to 15 minutes; clients should also delete their locally
stored tokens when logging out.

If a revoked refresh token is reused, the API revokes the token family and
returns `401 Unauthorized`. Logging out also revokes the family, so its refresh
tokens can no longer be used.

## Error response format

Errors use this JSON shape:

```json
{
  "error": {
    "message": "Invalid or expired refresh token"
  }
}
```

Unexpected server errors return a generic `500 Internal Server Error` message.
Unknown routes return `404 Not Found`.

## Web app and extension

Both clients follow the same flow: keep the access token for authenticated
requests, use its `exp` claim to refresh before it expires, and replace the
refresh token after every successful refresh. Protect both tokens from
unintended disclosure and never send the refresh token as a Bearer token to
ordinary API endpoints.
