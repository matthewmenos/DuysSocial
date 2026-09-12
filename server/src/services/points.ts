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

export async function spendPoints(userId: number, amount: number, reason: string, ref = "") {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.points < amount) return false;
  await creditPoints(userId, -amount, reason, ref);
  return true;
}

export async function spendTokens(userId: number, amount: number) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.duysTokens < amount) return false;
  await prisma.user.update({ where: { id: userId }, data: { duysTokens: { decrement: amount } } });
  return true;
}

export async function creditTokens(userId: number, amount: number) {
  await prisma.user.update({ where: { id: userId }, data: { duysTokens: { increment: amount } } });
}
