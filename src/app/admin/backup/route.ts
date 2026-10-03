import { audit } from "@/lib/audit";
import { assertSameOrigin, requireAdmin } from "@/lib/auth/server";
import { exportBackup } from "@/lib/backup";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Admin-only download of the whole league as JSON (POST so it cannot be triggered by a link). */
export async function POST() {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const backup = await exportBackup(db);
  await audit(db, { id: admin.id, runnerName: admin.runnerName }, "system.backup_download", {
    counts: backup.counts,
  });
  const day = backup.createdAt.slice(0, 10);
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="circuit-backup-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
