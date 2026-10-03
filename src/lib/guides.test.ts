import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../tests/test-db";
import { exportBackup } from "./backup";
import {
  STARTER_GUIDES,
  addStarterGuides,
  createGuide,
  deleteGuide,
  getPublishedGuide,
  listPublishedGuides,
  restoreGuideRevision,
  slugify,
  updateGuide,
} from "./guides";

describe("slugify", () => {
  it.each([
    ["How to play Netrunner", "how-to-play-netrunner"],
    ["  FAQ!!  ", "faq"],
    ["Venue & what to bring", "venue-what-to-bring"],
    ["Café rules", "cafe-rules"],
  ])("%s -> %s", (input, out) => expect(slugify(input)).toBe(out));
});

describe("starter guides", () => {
  it("are drafts for the organizer to fill in, pointing to official sources", () => {
    for (const g of STARTER_GUIDES) expect(g.body).toMatch(/Organizer/);
    const all = STARTER_GUIDES.map((g) => g.body).join("\n");
    expect(all).toContain("https://nullsignal.games");
    expect(all).toContain("/rules");
  });
});

describe.skipIf(!hasTestDb)("guides (database)", () => {
  let db: PrismaClient;
  let actor: { id: string; runnerName: string };
  beforeAll(() => {
    db = testDb();
  });
  beforeEach(async () => {
    await resetDb(db);
    const a = await db.user.create({
      data: { runnerName: "Org", runnerNameLower: "org", passwordHash: "x", role: "ADMIN" },
    });
    actor = { id: a.id, runnerName: "Org" };
  });
  afterAll(() => db.$disconnect());

  const page = { title: "House rules", slug: "", body: "Be nice.", sortOrder: 5, published: true };

  it("creates a page with a generated slug and a first revision; only published pages are public", async () => {
    const res = await createGuide(db, actor, page);
    if (!res.ok) throw new Error(JSON.stringify(res));
    expect(await getPublishedGuide(db, "house-rules")).toMatchObject({
      title: "House rules",
      body: "Be nice.",
    });
    expect(await db.guideRevision.count({ where: { pageId: res.id } })).toBe(1);
    await createGuide(db, actor, { ...page, title: "Secret draft", published: false });
    expect((await listPublishedGuides(db)).map((p) => p.slug)).toEqual(["house-rules"]);
    expect(await getPublishedGuide(db, "secret-draft")).toBeNull();
    expect(await getPublishedGuide(db, "../etc/passwd")).toBeNull();
    expect(await db.auditLog.count({ where: { action: "guide.create" } })).toBe(2);
  });

  it("validates input and refuses duplicate web addresses", async () => {
    expect(await createGuide(db, actor, { ...page, title: "" })).toMatchObject({
      fieldErrors: { title: expect.any(String) },
    });
    expect(await createGuide(db, actor, { ...page, slug: "Bad Slug!" })).toMatchObject({
      fieldErrors: { slug: expect.any(String) },
    });
    expect(await createGuide(db, actor, { ...page, body: "x".repeat(20_001) })).toMatchObject({
      fieldErrors: { body: expect.any(String) },
    });
    await createGuide(db, actor, page);
    expect(await createGuide(db, actor, page)).toMatchObject({
      fieldErrors: { slug: "Another page already uses this web address." },
    });
  });

  it("keeps a revision per content change and restores old versions", async () => {
    const res = await createGuide(db, actor, page);
    if (!res.ok) throw new Error();
    await updateGuide(db, actor, res.id, { ...page, body: "Be very nice." });
    await updateGuide(db, actor, res.id, { ...page, body: "Be very nice.", published: false }); // no content change
    const revs = await db.guideRevision.findMany({
      where: { pageId: res.id },
      orderBy: { createdAt: "asc" },
    });
    expect(revs.map((r) => r.body)).toEqual(["Be nice.", "Be very nice."]);

    expect(await restoreGuideRevision(db, actor, res.id, revs[0]!.id)).toEqual({ ok: true });
    expect((await db.guidePage.findUniqueOrThrow({ where: { id: res.id } })).body).toBe("Be nice.");
    expect(await db.guideRevision.count({ where: { pageId: res.id } })).toBe(3);
    expect(await restoreGuideRevision(db, actor, "other", revs[0]!.id)).toMatchObject({ ok: false });
  });

  it("deletes a page only with the typed title", async () => {
    const res = await createGuide(db, actor, page);
    if (!res.ok) throw new Error();
    expect(await deleteGuide(db, actor, res.id, "house rules")).toMatchObject({ ok: false });
    expect(await deleteGuide(db, actor, res.id, "House rules")).toEqual({ ok: true });
    expect(await db.guidePage.count()).toBe(0);
    expect(await db.guideRevision.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "guide.delete" } })).toBe(1);
  });

  it("adds starter drafts once, unpublished, and they are included in backups", async () => {
    expect(await addStarterGuides(db, actor)).toEqual({ ok: true, created: STARTER_GUIDES.length });
    expect(await addStarterGuides(db, actor)).toEqual({ ok: true, created: 0 });
    expect(await listPublishedGuides(db)).toEqual([]);
    const backup = await exportBackup(db);
    expect(backup.counts.guidePage).toBe(STARTER_GUIDES.length);
    expect(backup.counts.guideRevision).toBe(STARTER_GUIDES.length);
  });

  it("keeps edit history when the editor's account is deleted", async () => {
    const res = await createGuide(db, actor, page);
    if (!res.ok) throw new Error();
    await db.user.delete({ where: { id: actor.id } });
    expect(await db.guideRevision.findFirstOrThrow()).toMatchObject({ editorId: null, editorName: "Org" });
  });
});
