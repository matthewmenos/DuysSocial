import { prisma } from "../prisma.js";
import { config } from "../config.js";

export async function creditPoints(userId: number, delta: number, reason: string, ref = "") {
  if (!delta) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { points: { increment: delta } } }),
    prisma.pointLedger.create({ data: { userId, delta, reason, ref } }),
  ]);
  if (delta > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.referredById) {
      const cut = Math.max(1, Math.floor(delta * config.referralEarnPercent));
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.referredById }, data: { points: { increment: cut } } }),
        prisma.pointLedger.create({
          data: { userId: user.referredById, delta: cut, reason: "referral_cut", ref: String(userId) },
        }),
      ]);
    }
  }
}

/**
 * ATOMIC points debit: the `points >= amount` guard lives in the WHERE clause, so
 * concurrent spends (tip + claim + shop at once) can never overdraw a balance —
 * the previous read-then-decrement version could.
 */
export async function spendPoints(userId: number, amount: number, reason: string, ref = "") {
  if (amount <= 0) return true;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, points: { gte: amount } },
      data: { points: { decrement: amount } },
    });
    if (updated.count === 0) return false;
    await tx.pointLedger.create({ data: { userId, delta: -amount, reason, ref } });
    return true;
  });
}

/** ATOMIC token debit using the same guarded-update pattern. */
export async function spendTokens(userId: number, amount: number) {
  if (amount <= 0) return true;
  const updated = await prisma.user.updateMany({
    where: { id: userId, duysTokens: { gte: amount } },
    data: { duysTokens: { decrement: amount } },
  });
  return updated.count > 0;
}

export async function creditTokens(userId: number, amount: number) {
  await prisma.user.update({ where: { id: userId }, data: { duysTokens: { increment: amount } } });
}
