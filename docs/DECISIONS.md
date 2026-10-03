# Decisions log

Owner-approved decisions (2026-10-03):

| Topic | Decision |
| --- | --- |
| Hosting | Vercel (app) + Neon (Postgres). Owner provisions accounts by following the README; nothing is provisioned by Claude. |
| Email reset | Not built. Password resets are done by the admin issuing a one-time temporary password. Email field stays optional. |
| Domain | Free `*.vercel.app` address to start; custom domain can be added later. |
| Backups | Neon point-in-time restore + nightly `pg_dump` GitHub Action (private artifact, 90 days) + admin "download backup" button. |
| Rate limiting | Postgres-backed fixed-window buckets (`RateLimit` table); no extra service. |
| Time zone | Configurable via `APP_TIMEZONE` (default UTC). |
| Sessions | Own implementation: random 256-bit token in an HttpOnly/Secure/SameSite=Lax cookie; SHA-256 of the token stored in `Session`. 30-day sliding expiry. Revoked on password change / disable. |
| Runner names | ASCII letters, digits, space, `_`, `-` (3-24). ASCII-only avoids look-alike Unicode impersonation. |
| Prisma | 7.10 (latest stable; 8.x is still a release candidate), `prisma-client` generator + `@prisma/adapter-pg`. |
| Fonts | System font stacks (no build-time font download). |

Rules interpretations (owner accepted the proposals; to be re-checked against the prototype):

- Swiss-only event points by final Swiss rank: 1st 10, 2nd 7, 3rd-4th 5, 5th-8th 3, everyone else who played 1.
- Sign-ups: every sign-up is approved by the admin into an entrant.
- Guest claim: admin links a guest's entrant records to an account in `/admin/players`.
- Open (needs `reference/prototype.html`): whether byes count in SoS, cut larger than field, whether drop-after-round-1 / bye-only counts as "played".
