import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { creditPoints } from "./points.js";

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export function sanitizeUsername(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export async function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) return;
  const hash = await bcrypt.hash(config.adminPassword, 12);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: config.adminEmail }, { username: config.adminUsername }] },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isAdmin: true, email: config.adminEmail, username: config.adminUsername, passwordHash: existing.passwordHash || hash },
    });
    return;
  }
  await prisma.user.create({
    data: {
      email: config.adminEmail,
      username: config.adminUsername,
      displayName: "Admin",
      passwordHash: hash,
      isAdmin: true,
    },
  });
}

export async function applyReferral(newUserId: number, refUsername: string) {
  const ref = sanitizeUsername(refUsername);
  if (!ref) return;
  const referrer = await prisma.user.findUnique({ where: { username: ref } });
  if (!referrer || referrer.id === newUserId) return;
  await prisma.user.update({ where: { id: newUserId }, data: { referredById: referrer.id } });
  await prisma.referral.create({ data: { referrerId: referrer.id, refereeId: newUserId } }).catch(() => {});
  await creditPoints(referrer.id, config.pointsReferralBonus, "referral_signup", String(newUserId));
}

export async function seedConfig() {
  const defaults: Record<string, string> = {
    announcement_enabled: "0",
    announcement_text: "",
    post_char_limit: String(config.postCharLimit),
    post_char_limit_verified: String(config.postCharLimitVerified),
    verification_fee_blue: "5",
    verification_fee_gold: "25",
    verification_fee_grey: "15",
    boost_fee_usd_per_day: "1",
    swap_buy_enabled: "1",
    swap_sell_enabled: "1",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.appConfig.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}
