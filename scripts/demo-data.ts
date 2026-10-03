/**
 * Fills a LOCAL database with demo data: one archived season and a live season with finished
 * events, so every page has something to show. Refuses to run if any season exists.
 *
 *   pnpm db:demo            (uses DATABASE_URL from .env)
 *
 * Demo accounts all use the password "demo-password-123". Never run this against production.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { seededRng } from "../src/engine";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";
import { seedAdmin } from "../src/lib/seed-admin";
import { opFinish, opPairNext, opSetResult, opStartCut, opStartSwiss } from "../src/lib/tournament/ops";
import { addPlayerByName } from "../src/lib/tournament/registration";
import { archiveSeason } from "../src/lib/tournament/resets";
import { createSeason, updateEventSetup, updatePrizes } from "../src/lib/tournament/season";
import { loadEvent } from "../src/lib/tournament/state";

const PLAYERS = [
  "Kate Mac",
  "Gabe Santiago",
  "Noise",
  "Whizzard",
  "Reina Roja",
  "Andromeda",
  "Hayley Kaplan",
  "Leela Patel",
  "Omar Keung",
  "Steve Cambridge",
];
const WALK_INS = ["Sunny Lebeau", "Ji Reilly"];
const PASSWORD = "demo-password-123";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (/neon\.tech|vercel/i.test(url))
    throw new Error("This looks like a production database. Demo data is for local use only.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    if (await db.season.count())
      throw new Error(
        "The database already has seasons. Demo data needs an empty league (use Reset everything first).",
      );
    await seedAdmin(db, {
      ADMIN_RUNNER_NAME: process.env.ADMIN_RUNNER_NAME,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    });
    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const actor = { id: admin.id, runnerName: admin.runnerName };
    const hash = await hashPassword(PASSWORD);
    for (const name of PLAYERS) {
      await db.user.upsert({
        where: { runnerNameLower: name.toLowerCase() },
        create: { runnerName: name, runnerNameLower: name.toLowerCase(), passwordHash: hash },
        update: {},
      });
    }
    const rng = seededRng(2026);
    const pick = (n: number) => [...PLAYERS, ...WALK_INS].sort(() => rng() - 0.5).slice(0, n);

    async function run(
      eventId: string,
      players: string[],
      opts: { format?: "SINGLE" | "DOUBLE"; cut?: number; rounds?: number },
    ) {
      const ev = await db.event.findUniqueOrThrow({ where: { id: eventId } });
      await updateEventSetup(db, actor, eventId, {
        name: ev.name,
        date: ev.date.toISOString().slice(0, 10),
        month: String(ev.month),
        matchFormat: opts.format ?? "SINGLE",
        swissRounds: String(opts.rounds ?? 3),
        cutSize: String(opts.cut ?? 0),
      });
      for (const p of players) await addPlayerByName(db, actor, eventId, p);
      await opStartSwiss(db, actor, eventId, rng);
      const result = () => {
        const r = rng();
        return r < 0.08 ? "D" : r < 0.55 ? "A" : "B";
      };
      for (;;) {
        const { state } = await loadEvent(db, eventId);
        if (state.status === "done") break;
        const phase = state.status === "cut" ? "cut" : "swiss";
        const rounds = phase === "cut" ? state.cut : state.rounds;
        const ri = rounds.length - 1;
        for (const [mi, m] of rounds[ri]!.matches.entries()) {
          if (!m.b || m.g1) continue;
          await opSetResult(
            db,
            actor,
            eventId,
            {
              phase,
              round: ri,
              match: mi,
              game: 1,
              result: phase === "cut" ? (rng() < 0.5 ? "A" : "B") : result(),
            },
            rng,
          );
          if (phase === "swiss" && state.format === "double")
            await opSetResult(
              db,
              actor,
              eventId,
              { phase, round: ri, match: mi, game: 2, result: result() },
              rng,
            );
        }
        if (phase === "cut") continue;
        const now = (await loadEvent(db, eventId)).state;
        if (now.rounds.length < (now.swissRounds ?? 0)) await opPairNext(db, actor, eventId, rng);
        else if (now.cutSize > 0) await opStartCut(db, actor, eventId, rng);
        else await opFinish(db, actor, eventId);
      }
    }

    // Past season: all four events, then archived.
    const past = await createSeason(db, actor, { name: "Season 1", firstDate: "2026-06-06" });
    if (!past.ok) throw new Error("season");
    await updatePrizes(db, actor, past.seasonId, {
      month1: "Alt-art Hedge Fund",
      month2: "Playmat",
      season: "Champion's trophy",
    });
    for (const [i, e] of (
      await db.event.findMany({ where: { seasonId: past.seasonId }, orderBy: { index: "asc" } })
    ).entries()) {
      await run(e.id, pick(8 + i), { cut: i % 2 ? 4 : 0 });
    }
    await archiveSeason(db, actor, past.seasonId, "Season 1");

    // Live season: events 1-2 finished, event 3 open for sign-ups.
    const live = await createSeason(db, actor, { name: "Season 2", firstDate: "2026-09-19" });
    if (!live.ok) throw new Error("season");
    await updatePrizes(db, actor, live.seasonId, {
      month1: "Promo playset",
      month2: "Sleeves + deck box",
      season: "Trophy + title",
    });
    const events = await db.event.findMany({ where: { seasonId: live.seasonId }, orderBy: { index: "asc" } });
    await run(events[0]!.id, pick(10), { cut: 8, rounds: 4 });
    await run(events[1]!.id, pick(9), { format: "DOUBLE", cut: 4, rounds: 3 });
    for (const name of PLAYERS.slice(0, 5)) {
      const u = await db.user.findUniqueOrThrow({ where: { runnerNameLower: name.toLowerCase() } });
      await db.signup.create({ data: { eventId: events[2]!.id, userId: u.id } });
    }
    console.log(`Demo data created. Player accounts use the password "${PASSWORD}".`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
