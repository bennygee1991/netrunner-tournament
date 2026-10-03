import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for uptime monitors. Reveals nothing beyond ok/error. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
