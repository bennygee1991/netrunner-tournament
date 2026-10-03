import { exportMyData } from "@/lib/auth/accounts";
import { assertSameOrigin, requireUser } from "@/lib/auth/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** "Download my data": everything stored about the signed-in player (POST, same-origin only). */
export async function POST() {
  await assertSameOrigin();
  const user = await requireUser({ allowForcedChange: true });
  const data = await exportMyData(db, user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-circuit-data-${data.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
