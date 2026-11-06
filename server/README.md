# FocusDock API

The sync backend for FocusDock: accounts, wrapped vault keys and encrypted
vault items, stored in MongoDB. It is a separate npm project, like
`landing/`, and is never bundled into the desktop app.

The server never sees anything readable. The desktop app encrypts every
vault item before upload, and the vault key is wrapped by a passphrase that
never leaves the user's computer. A full database leak exposes only
ciphertext, email addresses and Argon2id password hashes.

## Run it locally

```bash
cd server
npm run db:up               # local MongoDB 7 in Docker (docker-compose.yml), data kept in a volume
cp .env.example .env        # then set JWT_SECRET: openssl rand -base64 48
npm install
npm run dev                 # http://localhost:8080/v1/health
npm test                    # needs the local MongoDB above
npm run db:shell            # mongosh into the dev database
npm run db:down             # stop it
```

Local development uses this Docker MongoDB until Atlas is set up. Moving to
Atlas later only changes `MONGODB_URI`; the server runs its migrations on
the new database the first time it starts.

## Endpoints (v1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/health` | — | Liveness plus a database ping. Render's health check. |
| GET | `/v1/meta` | — | API version, schema version, `minClient`, `latestClient` |
| POST | `/v1/auth/register` | — | `{ email, password, device? }` → user and token pair |
| POST | `/v1/auth/login` | — | Same body and response as register |
| POST | `/v1/auth/refresh` | — | `{ refreshToken }` → new pair; the old token stops working |
| POST | `/v1/auth/logout` | — | `{ refreshToken }` → ends that device's session |
| GET | `/v1/me` | Bearer | The signed-in account |
| GET | `/v1/vault/keys` | Bearer | The wrapped vault key, or `404 no_vault` |
| PUT | `/v1/vault/keys` | Bearer | Create the vault key (`409 vault_exists` if there is one), or replace it with `ifUpdatedAt` from your last read (`409 vault_changed` if it moved) |
| POST | `/v1/sync/push` | Bearer | Up to 200 encrypted items → `accepted`, `conflicts`, `cursor` |
| GET | `/v1/sync/pull?since=N&limit=500` | Bearer | Items changed after `N`, oldest first → `items`, `cursor`, `more` |

### Sync rules

- Each item is `{ id (UUID), kind, parentId, data: { v, iv, ct, tag }, rev, deleted }`.
  The server checks the shape and size, never the content.
- A push only replaces an item when its `rev` is higher than the stored one.
  Otherwise it comes back in `conflicts` with the server's `rev`, and the app
  pulls the newer copy and keeps its own as a conflict copy.
- Every saved item gets the next number in the account's sequence. Pushes
  for one account run one at a time (a 15-second lock on its counter), so
  the sequence has no gaps and a pull can never skip an item.
- Deletes are items with `deleted: true`, so they reach every computer.
- Pushing needs a vault key on the account first (`409 no_vault`).
- Unknown `kind` values are stored and returned unchanged, so a newer app
  can add one without a server release.

Errors are always `{ error: "<code>", message: "<sentence for the user>" }`.

### Sessions

- Access tokens are 15-minute HS256 JWTs.
- Refresh tokens are random 32-byte strings that last 30 days. Only their
  SHA-256 is stored.
- Every refresh replaces the token. Presenting a replaced token again means
  it was copied, so every session for that account is revoked.
- Login and register allow 5 attempts per minute per IP (`AUTH_RATE_LIMIT_MAX`).

### Version gate

The desktop app sends `X-FocusDock-Version`. Below `MIN_CLIENT`, every route
except `/v1/health` and `/v1/meta` answers `426 client_outdated`, and the app
pauses sync and asks the user to update. Local use keeps working.

## Database

| Collection | Holds |
|---|---|
| `users` | `_id` (UUID), `email` (unique, lowercased), `passwordHash` (Argon2id), `createdAt` |
| `sessions` | Hashed refresh tokens, family, device; MongoDB deletes them at `expiresAt` |
| `vault_keys` | One per user: scrypt settings plus the vault key wrapped by passphrase and by recovery key |
| `vault_items` | Encrypted sections and notes: `data: { v, iv, ct, tag }`, `rev`, `deleted`, `seq` |
| `counters` | Per-user change counter that feeds `vault_items.seq` |
| `migrations` | Applied schema versions |

Validators require each collection's fields and types but allow extra
fields, so a newer server can add one without breaking an older one.

### Migrations

Steps live in `src/migrations/NNN-name.js` and are listed in order in
`src/migrations/index.js`. The server applies pending steps on boot before
it takes traffic, and `npm run migrate` does the same on its own. A lock
document stops two instances migrating at once. The server refuses to start
against a database that is newer than it knows. See `../VERSIONING.md` for
the rules, especially R5 (expand, then contract) and R6 (server goes first).

## Deploy: MongoDB Atlas + Render

1. **Atlas** (cloud.mongodb.com): create a free **M0** cluster. Pick the
   region nearest your users; Render's Singapore region pairs with AWS
   Mumbai or Singapore.
2. **Database Access**: add a user, e.g. `focusdock-api`, with a generated
   password and the *Read and write to any database* role. To lock it down
   further, use a custom role limited to the `focusdock` database.
3. **Network Access**: Render's free plan has no fixed outbound IP, so allow
   `0.0.0.0/0`. The database user's password is the real gate. On a paid
   Render plan, use its static outbound IPs instead.
4. **Connect → Drivers**: copy the `mongodb+srv://...` string.
5. **Render**: New → Blueprint → this repository. It reads `render.yaml`,
   generates `JWT_SECRET` and asks for `MONGODB_URI`. Paste the string
   there and nowhere else.
6. Open `https://<service>.onrender.com/v1/health` and check it returns
   `{"ok":true,"db":"up"}`.

The free Render plan sleeps after 15 idle minutes and takes a few seconds
to wake. That's fine while sync runs in the background during beta. Move to
a paid plan before 1.0.
