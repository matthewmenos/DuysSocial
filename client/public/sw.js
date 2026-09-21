/* DUYS service worker — offline fallback only.
 *
 * IMPORTANT: this worker must never answer a script/style request with plain
 * text. Doing so makes the browser try to parse "Offline" as JavaScript, which
 * throws a syntax error and leaves the page completely blank after a refresh —
 * exactly what used to happen on flaky networks / mid-deploy asset 404s.
 */
const OFFLINE_URL = "/offline.html";
const SHELL_CACHE = "duys-shell";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll([OFFLINE_URL])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches created by older worker versions (keep the current shell).
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("duys-") && k !== SHELL_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only ever touch same-origin requests.
  if (url.origin !== self.location.origin) return;
  // Never touch the API, media or the socket — they must fail loudly.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/media") || url.pathname.startsWith("/socket.io")) return;

  // Navigations: network first, fall back to the offline shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || new Response("<h1>Offline</h1>", {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }),
    );
  }
  // Everything else (JS/CSS/images) is left to the browser's normal network
  // behaviour, so a failed request 404s instead of returning a broken body.
});

