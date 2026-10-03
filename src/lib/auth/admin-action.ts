import "server-only";
import type { Actor } from "../audit";
import { assertSameOrigin, requireAdmin } from "./server";

/** Every admin server action starts here: same-origin check plus a server-side admin role check. */
export async function adminActor(): Promise<Actor> {
  await assertSameOrigin();
  const admin = await requireAdmin();
  return { id: admin.id, runnerName: admin.runnerName };
}
