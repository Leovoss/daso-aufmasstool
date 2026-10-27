# DaSo Aufmaßtool

Quantity surveys (Aufmaß), extra-effort and timesheet reports for DaSo Lüftungsbau:
bill-of-quantities import, customer PDF packages, customer return review, weekly
closing and invoice preparation. Access is restricted to DaSo staff through
Cloudflare Access.

## Stack

- Next.js on [vinext](https://github.com/cloudflare/vinext), deployed as a Cloudflare Worker
- Cloudflare D1 for records, Cloudflare R2 for files and outgoing mail
- Cloudflare Access for sign-in. The Worker verifies the signed Access token on
  every request; roles (Planer / Obermonteur) are checked server-side in `lib/auth.ts`
- PHP mail relay (`mail-relay/relay.php`) for SMTP/IMAP over HTTPS

## Local development

Requires Node.js `>=22.13.0` and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

For local development put `DASO_DEV_IDENTITY=1` in `.dev.vars` (git-ignored); the app then
treats unauthenticated requests as a local Planer. Never set it in production. Tests:

```bash
pnpm test
```

## Configuration

Worker secrets (`wrangler secret put <name> --name daso-aufmasstool`):

| Name | Purpose |
| --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | Zero Trust team domain, e.g. `team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Audience tag of the Cloudflare Access application |
| `DASO_OWNER_EMAIL` | Email that is always a Planer |
| `DASO_SETTINGS_KEY` | Base64 32-byte key for the encrypted mailbox settings |
| `DASO_CRON_SECRET` | Bearer token for `POST /api/inbox/run` from a scheduler |
| `DASO_INBOX_SERVICE_ENABLED` | `1` allows the inbox sync endpoint |

Roles are `access:<email>` records in `records` (Planer or Obermonteur).

## Build and deploy

The Worker `daso-aufmasstool` is connected to this repository through Cloudflare
Workers Builds. Build settings:

- Build command: `pnpm install --frozen-lockfile && pnpm run build && node scripts/patch-wrangler-config.mjs`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`

`.github/workflows/ci.yml` runs type-check and tests on every push.

## Database migrations

```bash
pnpm run db:generate
wrangler d1 execute DB --remote --config dist/server/wrangler.json --file drizzle/<migration>.sql
```

The database `daso-aufmass` is separate from Montageplanung. Apply
`drizzle/0000_hard_bill_hollister.sql` once to a new, empty database.
