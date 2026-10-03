import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

export type Actor = { id: string; runnerName: string };

type Tx = PrismaClient | Prisma.TransactionClient;

/** Writes one audit row: who, what, when, and a before/after summary. */
export async function audit(db: Tx, actor: Actor, action: string, detail: Prisma.InputJsonObject = {}) {
  await db.auditLog.create({
    data: { actorId: actor.id, actorName: actor.runnerName, action, detailJson: detail },
  });
}
