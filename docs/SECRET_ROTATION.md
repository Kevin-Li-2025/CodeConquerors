# Secret Rotation

## Immediate Rotation Needed

The repository previously tracked a real `.env`. Treat every value that appeared there as exposed:

- database passwords and URLs
- Vercel/Postgres connection strings
- any copied local API secrets

Rotate those credentials in the upstream provider, then replace local `.env` values. The tracked `.env` has been removed and ignore rules now prevent re-adding it, but Git history still contains the old values.

## JWT Signing Key Rotation

The API now supports a current signing key plus previous keys:

- `Jwt__Key`: current signing key used for newly issued access tokens
- `Jwt__PreviousKeys`: comma- or semicolon-separated previous keys accepted for validation only

Rotation sequence:

1. Generate a new high-entropy `Jwt__Key`.
2. Move the old `Jwt__Key` into `Jwt__PreviousKeys`.
3. Deploy all API instances.
4. Wait longer than `Jwt__AccessTokenExpirationMinutes`.
5. Remove the old key from `Jwt__PreviousKeys`.

The development placeholder key is rejected outside `Development`.

## Refresh Tokens

Refresh tokens are now stored as SHA-256 hashes in the existing `refresh_token.token` column. The raw refresh token is returned to the client once and is never persisted.

Legacy raw tokens are still accepted temporarily during refresh/revoke lookups so existing sessions can rotate naturally. Once active sessions have expired, the compatibility branch can be removed.
