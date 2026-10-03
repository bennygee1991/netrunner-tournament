import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Actor, audit } from "./audit";

/** Guides (wiki) pages: organizer-written Markdown with full revision history. */

export const GUIDE_BODY_MAX = 20_000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

const guideInput = z
  .object({
    title: z.string().trim().min(1, "Give the page a title.").max(80, "Title must be at most 80 characters."),
    slug: z.string().trim().toLowerCase().max(60, "Web address must be at most 60 characters."),
    body: z.string().max(GUIDE_BODY_MAX, `Page text must be at most ${GUIDE_BODY_MAX} characters.`),
    sortOrder: z.coerce.number().int().min(0).max(999).default(100),
    published: z.boolean(),
  })
  .transform((v) => ({ ...v, slug: v.slug || slugify(v.title), body: v.body.replace(/\r\n/g, "\n") }))
  .refine((v) => SLUG.test(v.slug), {
    path: ["slug"],
    message: "Use lowercase letters, digits and dashes, e.g. how-to-play.",
  });

type Fail = { ok: false; error?: string; fieldErrors?: Partial<Record<string, string>> };

function firstErrors(err: z.ZodError) {
  const out: Partial<Record<string, string>> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

const idSchema = z.string().min(1).max(64);

export async function createGuide(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
): Promise<{ ok: true; id: string } | Fail> {
  const parsed = guideInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error) };
  const v = parsed.data;
  try {
    const page = await db.$transaction(async (tx) => {
      const p = await tx.guidePage.create({ data: v });
      await tx.guideRevision.create({
        data: {
          pageId: p.id,
          title: v.title,
          body: v.body,
          editorId: actor.id,
          editorName: actor.runnerName,
        },
      });
      await audit(tx, actor, "guide.create", {
        pageId: p.id,
        title: v.title,
        slug: v.slug,
        published: v.published,
      });
      return p;
    });
    return { ok: true, id: page.id };
  } catch (err) {
    if (isUniqueViolation(err))
      return { ok: false, fieldErrors: { slug: "Another page already uses this web address." } };
    throw err;
  }
}

/** Saves changes; a new revision is recorded whenever the title or text changes. */
export async function updateGuide(
  db: PrismaClient,
  actor: Actor,
  pageId: unknown,
  raw: unknown,
): Promise<{ ok: true } | Fail> {
  const id = idSchema.safeParse(pageId);
  const page = id.success ? await db.guidePage.findUnique({ where: { id: id.data } }) : null;
  if (!page) return { ok: false, error: "Page not found." };
  const parsed = guideInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error) };
  const v = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      await tx.guidePage.update({ where: { id: page.id }, data: v });
      const contentChanged = v.title !== page.title || v.body !== page.body;
      if (contentChanged) {
        await tx.guideRevision.create({
          data: {
            pageId: page.id,
            title: v.title,
            body: v.body,
            editorId: actor.id,
            editorName: actor.runnerName,
          },
        });
      }
      await audit(tx, actor, "guide.update", {
        pageId: page.id,
        before: { title: page.title, slug: page.slug, published: page.published, length: page.body.length },
        after: { title: v.title, slug: v.slug, published: v.published, length: v.body.length },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err))
      return { ok: false, fieldErrors: { slug: "Another page already uses this web address." } };
    throw err;
  }
  return { ok: true };
}

/** Restores an earlier version (recorded as a new revision, so the restore itself can be undone). */
export async function restoreGuideRevision(
  db: PrismaClient,
  actor: Actor,
  pageId: unknown,
  revisionId: unknown,
): Promise<{ ok: true } | Fail> {
  const pid = idSchema.safeParse(pageId);
  const rid = idSchema.safeParse(revisionId);
  if (!pid.success || !rid.success) return { ok: false, error: "Version not found." };
  const rev = await db.guideRevision.findFirst({ where: { id: rid.data, pageId: pid.data } });
  if (!rev) return { ok: false, error: "Version not found." };
  await db.$transaction(async (tx) => {
    await tx.guidePage.update({ where: { id: rev.pageId }, data: { title: rev.title, body: rev.body } });
    await tx.guideRevision.create({
      data: {
        pageId: rev.pageId,
        title: rev.title,
        body: rev.body,
        editorId: actor.id,
        editorName: actor.runnerName,
      },
    });
    await audit(tx, actor, "guide.restore", {
      pageId: rev.pageId,
      title: rev.title,
      restoredFrom: rev.createdAt.toISOString(),
    });
  });
  return { ok: true };
}

/** Deletes a page and its history after typing the page title. */
export async function deleteGuide(
  db: PrismaClient,
  actor: Actor,
  pageId: unknown,
  confirmation: unknown,
): Promise<{ ok: true } | Fail> {
  const id = idSchema.safeParse(pageId);
  const page = id.success ? await db.guidePage.findUnique({ where: { id: id.data } }) : null;
  if (!page) return { ok: false, error: "Page not found." };
  if (typeof confirmation !== "string" || confirmation.trim() !== page.title) {
    return { ok: false, error: `Type the page title "${page.title}" exactly to confirm.` };
  }
  await db.$transaction(async (tx) => {
    await tx.guidePage.delete({ where: { id: page.id } });
    await audit(tx, actor, "guide.delete", { pageId: page.id, title: page.title, slug: page.slug });
  });
  return { ok: true };
}

// ------------------------------------------------------------------ starter pages

const NSG = "https://nullsignal.games";
const OPP = "https://access.nullsignal.games/OPPolicies/OPP-26.04-Text-Only.pdf";

/**
 * Draft pages for the organizer to fill in. They contain structure and links to official sources
 * only, never rules text written by us, and start unpublished.
 */
export const STARTER_GUIDES: { slug: string; title: string; sortOrder: number; body: string }[] = [
  {
    slug: "how-to-play",
    title: "How to play Netrunner",
    sortOrder: 10,
    body: `New to Netrunner? Start here.

> **Organizer:** replace these notes with your own introduction, or link to the official material below. Please keep rules explanations in line with the official rules.

## The official rules

- Null Signal Games (publisher of Netrunner): [nullsignal.games](${NSG})
- Learn-to-play material and the comprehensive rules are published by Null Signal Games.

## Our recommended first steps

1. _Organizer: e.g. come to a learn-to-play night, borrow a starter deck…_
2. _…_

## Useful sites

- [NetrunnerDB](https://netrunnerdb.com): card search and decklists
- [AlwaysBeRunning](https://alwaysberunning.net): tournaments and results
`,
  },
  {
    slug: "league-rules",
    title: "League and tournament rules",
    sortOrder: 20,
    body: `How events in this league run: pairings, sides, scoring, the top cut and league points are on the [Rules page](/rules), which always matches what the site does.

## Official tournament policies

- NSG Organized Play Policies: [OPP 26.04 (PDF)](${OPP})

## House rules

> **Organizer:** list anything specific to this league (deck legality, proxies, lateness policy…).

- _…_
`,
  },
  {
    slug: "venue",
    title: "Venue and what to bring",
    sortOrder: 30,
    body: `> **Organizer:** where you play and what players need.

## Where

_Address, opening times, accessibility, parking…_

## What to bring

- _e.g. your deck (sleeved), tokens, a pen…_
`,
  },
  {
    slug: "faq",
    title: "FAQ",
    sortOrder: 40,
    body: `## How do I sign up for an event?

Create an account on this site, then use **Sign up** on the home page. The organizer confirms your place.

## I forgot my password

Ask the organizer for a temporary password.

## How do league points work?

See [League points](/rules#league) on the Rules page.

> **Organizer:** add your own questions and answers.
`,
  },
];

export async function addStarterGuides(
  db: PrismaClient,
  actor: Actor,
): Promise<{ ok: true; created: number }> {
  const existing = new Set((await db.guidePage.findMany({ select: { slug: true } })).map((p) => p.slug));
  let created = 0;
  for (const g of STARTER_GUIDES) {
    if (existing.has(g.slug)) continue;
    const res = await createGuide(db, actor, { ...g, published: false });
    if (res.ok) created++;
  }
  return { ok: true, created };
}

// ------------------------------------------------------------------ queries

export function listPublishedGuides(db: PrismaClient) {
  return db.guidePage.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true, updatedAt: true },
  });
}

export function getPublishedGuide(db: PrismaClient, slug: string) {
  if (!SLUG.test(slug) || slug.length > 60) return Promise.resolve(null);
  return db.guidePage.findFirst({ where: { slug, published: true } });
}
