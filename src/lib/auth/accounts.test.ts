import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { verifyPassword } from "../password";
import {
  GENERIC_LOGIN_ERROR,
  adminDelete,
  adminIssueTempPassword,
  adminRename,
  adminSetDisabled,
  adminSetRole,
  exportMyData,
  selfDeleteAccount,
  authenticate,
  changePassword,
  readPrefs,
  registerUser,
  updateProfile,
} from "./accounts";
import { createSession, validateSession } from "./sessions";
import { SESSION_REFRESH_MS, hashToken } from "./tokens";
import { THEME_VALUES } from "../themes";

const GOOD = "violet-mainframe-42";
const reg = (runnerName: string, extra: Record<string, string> = {}) => ({
  runnerName,
  password: GOOD,
  confirm: GOOD,
  email: "",
  ...extra,
});

describe.skipIf(!hasTestDb)("accounts (database)", () => {
  let db: PrismaClient;
  let ipCounter = 0;
  const ip = () => `10.0.0.${++ipCounter}`;

  beforeAll(() => {
    db = testDb();
  });
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  async function makeAdmin() {
    const r = await registerUser(db, reg("Boss Admin"), ip());
    if (!r.ok) throw new Error("setup failed");
    await db.user.update({ where: { id: r.userId }, data: { role: "ADMIN" } });
    return { id: r.userId, runnerName: "Boss Admin" };
  }

  describe("register", () => {
    it("creates a player with an argon2id hash and a session", async () => {
      const r = await registerUser(db, reg("Kate Mac", { email: "Kate@Example.com" }), ip());
      expect(r.ok).toBe(true);
      const user = await db.user.findUniqueOrThrow({ where: { runnerNameLower: "kate mac" } });
      expect(user.runnerName).toBe("Kate Mac");
      expect(user.role).toBe("PLAYER");
      expect(user.email).toBe("kate@example.com");
      expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
      if (r.ok) expect((await validateSession(db, r.token))?.id).toBe(user.id);
    });

    it("rejects a runner name taken in any casing", async () => {
      await registerUser(db, reg("Noise"), ip());
      const r = await registerUser(db, reg("nOISE"), ip());
      expect(r).toMatchObject({ ok: false, fieldErrors: { runnerName: "That runner name is taken." } });
    });

    it("validates password strength, confirmation and email", async () => {
      expect(await registerUser(db, reg("Abe", { password: "short", confirm: "short" }), ip())).toMatchObject(
        {
          fieldErrors: { password: expect.stringMatching(/at least 10/) },
        },
      );
      expect(await registerUser(db, reg("Abe", { confirm: "different-pass-1" }), ip())).toMatchObject({
        fieldErrors: { confirm: "Passwords do not match." },
      });
      expect(await registerUser(db, reg("Abe", { email: "nope" }), ip())).toMatchObject({
        fieldErrors: { email: expect.any(String) },
      });
      expect(await db.user.count()).toBe(0);
    });

    it("rate-limits registrations per IP", async () => {
      const addr = ip();
      for (let i = 0; i < 5; i++) expect((await registerUser(db, reg(`Runner ${i}`), addr)).ok).toBe(true);
      const blocked = await registerUser(db, reg("Runner 6"), addr);
      expect(blocked).toMatchObject({ ok: false, error: expect.stringMatching(/Too many attempts/) });
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await registerUser(db, reg("Whizzard"), ip());
    });

    it("logs in case-insensitively", async () => {
      const r = await authenticate(db, { runnerName: "whizzard", password: GOOD }, ip());
      expect(r).toMatchObject({ ok: true, mustChangePassword: false });
    });

    it("gives the same generic error for a wrong password and an unknown runner", async () => {
      const wrong = await authenticate(db, { runnerName: "Whizzard", password: "nope nope nope" }, ip());
      const unknown = await authenticate(db, { runnerName: "Nobody", password: GOOD }, ip());
      expect(wrong).toEqual({ ok: false, error: GENERIC_LOGIN_ERROR });
      expect(unknown).toEqual({ ok: false, error: GENERIC_LOGIN_ERROR });
    });

    it("refuses disabled accounts with the generic error", async () => {
      await db.user.updateMany({ data: { disabledAt: new Date() } });
      expect(await authenticate(db, { runnerName: "Whizzard", password: GOOD }, ip())).toEqual({
        ok: false,
        error: GENERIC_LOGIN_ERROR,
      });
    });

    it("locks an account after 10 failures, even from different IPs", async () => {
      for (let i = 0; i < 10; i++) {
        await authenticate(db, { runnerName: "Whizzard", password: "wrong password!" }, ip());
      }
      const r = await authenticate(db, { runnerName: "Whizzard", password: GOOD }, ip());
      expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Too many attempts/) });
    });

    it("a successful login clears the failure counter", async () => {
      for (let i = 0; i < 9; i++) {
        await authenticate(db, { runnerName: "Whizzard", password: "wrong password!" }, ip());
      }
      expect((await authenticate(db, { runnerName: "Whizzard", password: GOOD }, ip())).ok).toBe(true);
      for (let i = 0; i < 9; i++) {
        await authenticate(db, { runnerName: "Whizzard", password: "wrong password!" }, ip());
      }
      expect((await authenticate(db, { runnerName: "Whizzard", password: GOOD }, ip())).ok).toBe(true);
    });

    it("rate-limits attempts per IP", async () => {
      const addr = ip();
      for (let i = 0; i < 30; i++)
        await authenticate(db, { runnerName: `x${i}`, password: "whatever!!" }, addr);
      expect(await authenticate(db, { runnerName: "Whizzard", password: GOOD }, addr)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/Too many attempts/),
      });
    });
  });

  describe("sessions", () => {
    it("stores only the token hash", async () => {
      const r = await registerUser(db, reg("Hash Check"), ip());
      if (!r.ok) throw new Error();
      const row = await db.session.findFirstOrThrow();
      expect(row.id).toBe(hashToken(r.token));
      expect(row.id).not.toBe(r.token);
    });

    it("rejects expired sessions and deletes them", async () => {
      const r = await registerUser(db, reg("Expiry"), ip());
      if (!r.ok) throw new Error();
      await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await validateSession(db, r.token)).toBeNull();
      expect(await db.session.count()).toBe(0);
    });

    it("slides the expiry forward when last seen over a day ago", async () => {
      const r = await registerUser(db, reg("Slider"), ip());
      if (!r.ok) throw new Error();
      const old = new Date(Date.now() - SESSION_REFRESH_MS - 1000);
      const soon = new Date(Date.now() + 60_000);
      await db.session.updateMany({ data: { lastSeenAt: old, expiresAt: soon } });
      expect(await validateSession(db, r.token)).not.toBeNull();
      const row = await db.session.findFirstOrThrow();
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    });

    it("rejects garbage tokens", async () => {
      expect(await validateSession(db, "")).toBeNull();
      expect(await validateSession(db, "x".repeat(500))).toBeNull();
      expect(await validateSession(db, "not-a-real-token")).toBeNull();
    });
  });

  describe("change password", () => {
    it("requires the current password and logs out other sessions only", async () => {
      const r = await registerUser(db, reg("Changer"), ip());
      if (!r.ok) throw new Error();
      const other = await createSession(db, r.userId);
      const bad = await changePassword(
        db,
        r.userId,
        { current: "wrong wrong wrong", password: "brand-new-pass-9", confirm: "brand-new-pass-9" },
        r.token,
      );
      expect(bad).toMatchObject({ fieldErrors: { current: "Current password is incorrect." } });

      const ok = await changePassword(
        db,
        r.userId,
        { current: GOOD, password: "brand-new-pass-9", confirm: "brand-new-pass-9" },
        r.token,
      );
      expect(ok).toEqual({ ok: true });
      expect(await validateSession(db, r.token)).not.toBeNull();
      expect(await validateSession(db, other)).toBeNull();
      const user = await db.user.findUniqueOrThrow({ where: { id: r.userId } });
      expect(await verifyPassword(user.passwordHash, "brand-new-pass-9")).toBe(true);
    });

    it("rejects reusing the same password", async () => {
      const r = await registerUser(db, reg("Same Pass"), ip());
      if (!r.ok) throw new Error();
      const res = await changePassword(
        db,
        r.userId,
        { current: GOOD, password: GOOD, confirm: GOOD },
        r.token,
      );
      expect(res).toMatchObject({ fieldErrors: { password: "Pick a new password." } });
    });
  });

  describe("profile", () => {
    it("saves theme and email", async () => {
      const r = await registerUser(db, reg("Prefs"), ip());
      if (!r.ok) throw new Error();
      expect(await updateProfile(db, r.userId, { theme: "light", email: "a@b.co" })).toEqual({ ok: true });
      const user = await db.user.findUniqueOrThrow({ where: { id: r.userId } });
      expect(readPrefs(user.prefs).theme).toBe("light");
      expect(user.email).toBe("a@b.co");
      expect((await updateProfile(db, r.userId, { theme: "hot-pink-unicorn", email: "" })).ok).toBe(false);
      // Every site theme can be saved and read back.
      for (const theme of THEME_VALUES) {
        expect(await updateProfile(db, r.userId, { theme, email: "" })).toEqual({ ok: true });
        expect(readPrefs((await db.user.findUniqueOrThrow({ where: { id: r.userId } })).prefs).theme).toBe(
          theme,
        );
      }
      await updateProfile(db, r.userId, { theme: "light", email: "a@b.co" });
      expect(await updateProfile(db, r.userId, { theme: "light", email: "", avatar: "eye-cyan" })).toEqual({
        ok: true,
      });
      expect((await db.user.findUniqueOrThrow({ where: { id: r.userId } })).avatar).toBe("eye-cyan");
      expect(
        (await updateProfile(db, r.userId, { theme: "light", email: "", avatar: "<svg onload=x>" })).ok,
      ).toBe(false);
      await updateProfile(db, r.userId, { theme: "light", email: "", avatar: "" });
      expect((await db.user.findUniqueOrThrow({ where: { id: r.userId } })).avatar).toBeNull();
    });
  });

  describe("admin tools", () => {
    it("temp password forces a change, logs the player out and is audited", async () => {
      const admin = await makeAdmin();
      const p = await registerUser(db, reg("Forgetful"), ip());
      if (!p.ok) throw new Error();
      const res = await adminIssueTempPassword(db, admin, p.userId);
      if (!res.ok) throw new Error();
      expect(await validateSession(db, p.token)).toBeNull();
      const login = await authenticate(db, { runnerName: "Forgetful", password: res.tempPassword }, ip());
      expect(login).toMatchObject({ ok: true, mustChangePassword: true });
      const log = await db.auditLog.findFirstOrThrow({ where: { action: "player.temp_password" } });
      expect(log.actorName).toBe("Boss Admin");
      expect(JSON.stringify(log.detailJson)).not.toContain(res.tempPassword);
    });

    it("rename keeps uniqueness and records before/after", async () => {
      const admin = await makeAdmin();
      const p = await registerUser(db, reg("Typo Nmae"), ip());
      if (!p.ok) throw new Error();
      expect(await adminRename(db, admin, p.userId, "boss admin")).toMatchObject({ ok: false });
      expect(await adminRename(db, admin, p.userId, "Typo Name")).toEqual({ ok: true });
      const log = await db.auditLog.findFirstOrThrow({ where: { action: "player.rename" } });
      expect(log.detailJson).toMatchObject({ before: "Typo Nmae", after: "Typo Name" });
    });

    it("disable logs the player out and blocks login; enable restores it", async () => {
      const admin = await makeAdmin();
      const p = await registerUser(db, reg("Rulebreaker"), ip());
      if (!p.ok) throw new Error();
      expect(await adminSetDisabled(db, admin, p.userId, true)).toEqual({ ok: true });
      expect(await validateSession(db, p.token)).toBeNull();
      expect((await authenticate(db, { runnerName: "Rulebreaker", password: GOOD }, ip())).ok).toBe(false);
      await adminSetDisabled(db, admin, p.userId, false);
      expect((await authenticate(db, { runnerName: "Rulebreaker", password: GOOD }, ip())).ok).toBe(true);
      expect(await adminSetDisabled(db, admin, admin.id, true)).toMatchObject({ ok: false });
    });

    it("promotes and demotes organizers, with guards, and the change applies to live sessions", async () => {
      const admin = await makeAdmin();
      const p = await registerUser(db, reg("Co Organizer"), ip());
      if (!p.ok) throw new Error();
      expect(await adminSetRole(db, admin, p.userId, "ADMIN")).toEqual({ ok: true });
      expect((await validateSession(db, p.token))?.role).toBe("ADMIN");
      expect(await adminSetRole(db, admin, admin.id, "PLAYER")).toMatchObject({ ok: false });
      expect(await adminSetRole(db, admin, p.userId, "OWNER")).toMatchObject({ ok: false });
      expect(await adminSetRole(db, admin, p.userId, "PLAYER")).toEqual({ ok: true });
      expect((await validateSession(db, p.token))?.role).toBe("PLAYER");
      expect(
        (
          await db.auditLog.findMany({
            where: { action: { in: ["player.make_admin", "player.remove_admin"] } },
          })
        ).length,
      ).toBe(2);

      await adminSetDisabled(db, admin, p.userId, true);
      expect(await adminSetRole(db, admin, p.userId, "ADMIN")).toMatchObject({
        ok: false,
        error: "Enable the account first.",
      });
    });

    it("delete needs the typed runner name and anonymises results", async () => {
      const admin = await makeAdmin();
      const p = await registerUser(db, reg("Leaving Soon"), ip());
      if (!p.ok) throw new Error();
      const season = await db.season.create({ data: { name: "S1", startDate: new Date() } });
      const event = await db.event.create({
        data: { seasonId: season.id, index: 1, name: "E1", date: new Date(), month: 1 },
      });
      await db.entrant.create({ data: { eventId: event.id, userId: p.userId } });

      expect(await adminDelete(db, admin, p.userId, "leaving soon")).toMatchObject({ ok: false });
      expect(await adminDelete(db, admin, p.userId, "Leaving Soon")).toEqual({ ok: true });
      expect(await db.user.findUnique({ where: { id: p.userId } })).toBeNull();
      const entrant = await db.entrant.findFirstOrThrow();
      expect(entrant.userId).toBeNull();
      expect(entrant.guestName).toMatch(/^Deleted player [A-Z0-9]{4}$/);
      expect(await db.auditLog.count({ where: { action: "player.delete" } })).toBe(1);
      expect(await adminDelete(db, admin, admin.id, "Boss Admin")).toMatchObject({ ok: false });
    });

    it("deleting an account also anonymises saved results, trophies and archived boards", async () => {
      const admin = await makeAdmin();
      const p = await registerUser(db, reg("Private Pat"), ip());
      if (!p.ok) throw new Error();
      const season = await db.season.create({
        data: { name: "S0", startDate: new Date(), status: "ARCHIVED" },
      });
      await db.eventRecord.create({
        data: {
          eventKey: "e0",
          seasonName: "S0",
          eventName: "E",
          eventDate: new Date(),
          userId: p.userId,
          playerName: "Private Pat",
          placing: "Champion",
          rank: 1,
          points: 10,
          wins: 2,
          draws: 0,
          losses: 0,
          champion: true,
          undefeated: true,
        },
      });
      await db.trophy.create({
        data: { kind: "event-champion", userId: p.userId, playerName: "Private Pat", seasonName: "S0" },
      });
      await db.leaderboardSnapshot.create({
        data: {
          seasonId: season.id,
          boardKey: "season",
          rowsJson: {
            prize: "",
            rows: [
              {
                key: `u:${p.userId}`,
                userId: p.userId,
                name: "Private Pat",
                rank: 1,
                total: 10,
                titles: 1,
                played: 1,
              },
            ],
          },
        },
      });
      expect(await adminDelete(db, admin, p.userId, "Private Pat")).toEqual({ ok: true });
      const everything = JSON.stringify([
        await db.eventRecord.findMany(),
        await db.trophy.findMany(),
        await db.leaderboardSnapshot.findMany(),
      ]);
      expect(everything).not.toContain("Private Pat");
      expect(everything).not.toContain(p.userId);
      expect(everything).toMatch(/Deleted player [A-Z0-9]{4}/);
      expect(await db.auditLog.findFirstOrThrow({ where: { action: "player.delete" } })).toMatchObject({
        detailJson: expect.objectContaining({
          recordsAnonymised: 1,
          trophiesAnonymised: 1,
          snapshotsAnonymised: 1,
        }),
      });
    });
  });

  describe("self-service", () => {
    it("players delete their own account with password and typed name", async () => {
      const p = await registerUser(db, reg("Leaving Lee"), ip());
      if (!p.ok) throw new Error();
      expect(await selfDeleteAccount(db, p.userId, { password: GOOD, confirm: "leaving lee" })).toMatchObject(
        { ok: false },
      );
      expect(
        await selfDeleteAccount(db, p.userId, { password: "wrong password!", confirm: "Leaving Lee" }),
      ).toMatchObject({
        fieldErrors: { password: "Password is incorrect." },
      });
      expect(await selfDeleteAccount(db, p.userId, { password: GOOD, confirm: "Leaving Lee" })).toEqual({
        ok: true,
      });
      expect(await db.user.findUnique({ where: { id: p.userId } })).toBeNull();
      expect(await validateSession(db, p.token)).toBeNull();
      const log = await db.auditLog.findFirstOrThrow({ where: { action: "player.self_delete" } });
      expect(log).toMatchObject({ actorId: null, actorName: "Leaving Lee" });
    });

    it("the only organizer cannot delete their account", async () => {
      const admin = await makeAdmin();
      expect(await selfDeleteAccount(db, admin.id, { password: GOOD, confirm: "Boss Admin" })).toMatchObject({
        ok: false,
        error: expect.stringMatching(/only organizer/),
      });
    });

    it("download my data includes the account and history but never the password hash", async () => {
      const p = await registerUser(db, reg("Data Dana", { email: "dana@example.com" }), ip());
      if (!p.ok) throw new Error();
      const data = await exportMyData(db, p.userId);
      expect(data.account).toMatchObject({ runnerName: "Data Dana", email: "dana@example.com" });
      expect(data.activeSessions).toHaveLength(1);
      const text = JSON.stringify(data);
      expect(text).not.toContain("argon2");
      expect(text).not.toContain("passwordHash");
      expect(text).not.toContain(p.token);
    });
  });
});
