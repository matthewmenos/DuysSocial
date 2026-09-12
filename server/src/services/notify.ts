import { prisma } from "../prisma.js";
import { config } from "../config.js";
import webpush from "web-push";

if (config.pushEnabled) {
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublic, config.vapidPrivate);
}

export async function notify(
  userId: number,
  text: string,
  opts: { actorId?: number; kind?: string; entityType?: string; entityId?: number } = {},
) {
  await prisma.notification.create({
    data: {
      userId,
      text,
      actorId: opts.actorId,
      kind: opts.kind || "system",
      entityType: opts.entityType || "",
      entityId: opts.entityId,
    },
  });
  if (config.pushEnabled) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: config.appName, body: text }),
          )
          .catch(() => {}),
      ),
    );
  }
}
