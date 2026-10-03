# Netrunner Circuit

A website for running a Netrunner league:
- Players register with their runner name and sign up for events.
- You (the organizer) run Swiss rounds and a top cut from your phone.
- Everyone can follow pairings, standings, two monthly leaderboards, a season leaderboard, past seasons and player trophies.

- **Running the league day to day:** see [docs/ORGANIZER_GUIDE.md](docs/ORGANIZER_GUIDE.md).
- **Changing the code:** see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

This page covers putting the site online, backing it up and fixing common problems. You do not
need to know how to code. Each step says exactly where to click. Allow about 30 minutes the first time.

---

## What you need

| Service | What it does | Cost |
| --- | --- | --- |
| [GitHub](https://github.com) | Stores the website's code (you already have this) | Free |
| [Neon](https://neon.tech) | The database: accounts, events, results | Free plan is enough for a league |
| [Vercel](https://vercel.com) | Runs the website | Free "Hobby" plan is enough |

You also need a password manager (or a safe note) for three things you will create:
- the admin password;
- the database connection strings;
- the backup passphrase.

---

## Part 1: Put the code on the main branch

The code lives in your GitHub repository `netrunner-tournament`.

1. Open the repository on GitHub.
2. If you see a yellow banner about the branch `claude/netrunner-circuit-app-…`, click **Compare & pull request**.
3. Click **Create pull request**, wait for the green check marks (the automatic tests), then click **Merge pull request**.

Vercel will publish whatever is on the `main` branch.

---

## Part 2: Create the database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (signing in with GitHub is easiest).
2. Create a project:
   - **Name:** `netrunner-circuit`.
   - **Region:** pick one close to your players. Remember it, because Vercel should use the same area in Part 3.
   - **Postgres version:** leave the default.
3. On the project dashboard, click **Connect**. You need two versions of the connection string:
   - **Pooled:** with the **Connection pooling** switch **on**, copy the string. Save it as `DATABASE_URL`.
   - **Direct:** switch **Connection pooling** **off** and copy the string again. Save it as `DIRECT_URL`.

   Both look like `postgresql://…@…neon.tech/neondb?sslmode=require`.

Keep these secret. Anyone who has them can read and change the league data.

---

## Part 3: Publish the website (Vercel)

1. Go to [vercel.com](https://vercel.com) and **Sign up with GitHub**.
2. Click **Add New… → Project**, find `netrunner-tournament` and click **Import**.
   - If you can't see it, click **Adjust GitHub App Permissions** and give Vercel access to that repository.
3. Leave **Framework Preset** as **Next.js** and leave the build settings alone.
4. Open **Environment Variables** and add these one by one (name on the left, value on the right):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the **pooled** Neon string from Part 2 |
   | `DIRECT_URL` | the **direct** Neon string from Part 2 |
   | `ADMIN_RUNNER_NAME` | your runner name, e.g. `Organizer` (3-24 letters, digits, spaces, `_` or `-`) |
   | `ADMIN_PASSWORD` | a strong password, at least 10 characters (a short phrase works well) |
   | `APP_TIMEZONE` | your time zone, e.g. `Europe/London` or `America/New_York` |

5. Click **Deploy** and wait about two minutes. Each deploy automatically:
   - creates or updates the database tables;
   - creates your admin account (only the first time).
6. Click the preview image to open your site. It lives at `https://<project-name>.vercel.app`.
7. Set the server region to match Neon: **Settings → Functions → Function Region** → choose the region closest to your Neon region → **Save**. Then go to **Deployments**, open the ⋯ menu on the newest deployment and choose **Redeploy**.

### First login

1. On your site, click **Log in** and use `ADMIN_RUNNER_NAME` and `ADMIN_PASSWORD`.
2. Open your name in the top right, go to **Account → Change password**, and choose a new password that you only keep in your password manager.
3. In Vercel, go to **Settings → Environment Variables** and **delete `ADMIN_PASSWORD`**. Your account is already created, so the site doesn't need it any more. Keep `ADMIN_RUNNER_NAME`; it does no harm.

You're live. Share the link with your players and see [the organizer guide](docs/ORGANIZER_GUIDE.md).

### Optional: your own domain

1. In Vercel, go to **Settings → Domains → Add** and follow the instructions there.
2. Add an environment variable `APP_URL` with the full address, e.g. `https://circuit.example.com` (no `/` at the end).
3. Redeploy.

Without `APP_URL`, forms submitted from the custom domain will be refused as a security measure.

---

## Part 4: Backups

There are three layers of backup. Set up the first two today.

### 1. Download a backup from the site (do this before every big change)

Go to **Admin → Dashboard → Download backup**. You get one file, `circuit-backup-YYYY-MM-DD.json`, with
everything in it: players, seasons, events, results, trophies and the audit log.

- Download one before you archive a season or use **Reset everything**.
- Keep the files somewhere private, such as a personal cloud drive folder. They contain player emails and scrambled passwords.

### 2. Automatic nightly backup (set up once)

Every night GitHub makes a complete copy of the database, locks it with a passphrase only you know, and
keeps each copy for 90 days.

1. Choose a long passphrase, e.g. five random words, and save it in your password manager. **Without it the backups cannot be opened.**
2. On GitHub, open the repository and go to **Settings → Secrets and variables → Actions → New repository secret**. Add two secrets:
   - `BACKUP_DATABASE_URL`: the **direct** Neon string (`DIRECT_URL`).
   - `BACKUP_PASSPHRASE`: the passphrase from step 1.
3. Test it: go to the **Actions** tab → **Nightly database backup** → **Run workflow**. After a minute or two the run turns green and shows a file under **Artifacts**.

To download a nightly backup later, go to **Actions → Nightly database backup**, click a run, and download the file under **Artifacts**.

GitHub pauses scheduled jobs in repositories that have had no activity for 60 days. If the
**Actions** tab says the workflow is disabled, click **Enable workflow**.

### 3. Neon's own restore points

Neon keeps a short history of the database (the length depends on your plan). If something has just
gone wrong, for example a reset by mistake, you may be able to rewind: in Neon, go to **Branches → Restore** or **Backup & Restore**.

---

## Restoring a backup

Restoring needs a computer with a terminal. If you're not comfortable with that, a technical friend
can do it in about 15 minutes with these steps. Either way, **restore into a fresh database, never
over the live one**:
1. In Neon, create a new project (or a new branch with no data).
2. Copy its direct connection string.
3. When the restore has worked, point Vercel at it by changing `DATABASE_URL` and `DIRECT_URL`, then redeploy.

**From a downloaded `.json` file.** You need Node.js 22 and pnpm.

```bash
git clone https://github.com/<you>/netrunner-tournament.git && cd netrunner-tournament
pnpm install
export DATABASE_URL="<new database, direct string>"
pnpm db:migrate                      # creates the empty tables
pnpm db:restore ~/Downloads/circuit-backup-2026-10-03.json
```

**From a nightly backup.** You need `gpg` and PostgreSQL 17 client tools.

```bash
unzip circuit-2026-10-03.dump.gpg.zip
gpg --decrypt circuit-2026-10-03.dump.gpg > circuit.dump      # asks for the backup passphrase
pg_restore --no-owner --no-privileges -d "<new database, direct string>" circuit.dump
```

---

## Updating the site

Any change merged into the `main` branch on GitHub is published by Vercel automatically within a
couple of minutes, including database changes. If a deploy fails, the previous version stays online.
Open the failed deployment in Vercel to see the error.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Deploy fails with "No admin account exists yet" | Add `ADMIN_RUNNER_NAME` and `ADMIN_PASSWORD` in Vercel (Part 3, step 4) and redeploy. |
| Deploy fails with "ADMIN_PASSWORD is invalid" | The password is too short or too common. Pick a longer one and redeploy. |
| Buttons do nothing and "Cross-site request blocked" appears in Vercel's logs | You're on a custom domain without `APP_URL`. Add it (see "Optional: your own domain"). |
| A player forgot their password | **Admin → Players** → search → **Issue temporary password**. Give them the code; they choose a new password when they log in. |
| **You** forgot the admin password | Ask another admin to issue you a temporary password. If you're the only admin, run `pnpm admin:reset-password "Your Name"` with `DATABASE_URL` set to the Neon direct string (needs Node.js; see Restoring above). |
| "Too many attempts" when logging in | Wait 15 minutes. It protects accounts from password guessing. |
| The first page load after a quiet day is slow | Normal on Neon's free plan: the database sleeps when unused and wakes in a second or two. |
| Something looks wrong after an event | **Admin → Audit** shows every admin action: who did it, when, and what changed. |

---

## Security, in short

- Passwords are stored with argon2id, a deliberately slow scrambling method that makes stolen password data very hard to crack.
- Logins are rate-limited per device and per account, and wrong logins all show the same message.
- Every admin page and action checks on the server that you're an admin.
- Destructive actions need you to type a confirmation, and everything is written to the audit log.
- Secrets live only in Vercel and GitHub settings, never in the code. `.env.example` lists every setting.
