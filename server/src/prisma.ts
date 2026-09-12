import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function getSetting(key: string, fallback: string | number | boolean) {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  if (!row) return fallback;
  if (typeof fallback === "boolean") return ["1", "true", "yes"].includes(row.value.toLowerCase());
  if (typeof fallback === "number") return Number(row.value);
  return row.value;
}

export async function setSetting(key: string, value: string | number | boolean) {
  const v = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  await prisma.appConfig.upsert({
    where: { key },
    create: { key, value: v },
    update: { value: v },
  });
}
