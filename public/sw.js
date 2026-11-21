const CACHE = "eleva-v2";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(SHELL, { credentials: "include" });
        if (cacheavel(res)) await cache.put(SHELL, res);
      } catch {
        // sem rede na instalação: guarda na próxima visita
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Não guarda redirecionamento de login nem resposta de erro.
function cacheavel(res) {
  return res && res.ok && !res.redirected && res.type === "basic";
}

async function redePrimeiro(request, chave) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (cacheavel(res)) await cache.put(chave || request, res.clone());
    return res;
  } catch (error) {
    const hit = await cache.match(chave || request);
    if (hit) return hit;
    throw error;
  }
}

async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheavel(res)) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(redePrimeiro(request, SHELL));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cachePrimeiro(request));
    return;
  }
  if (url.pathname === "/api/chamados" || url.pathname.endsWith("/audio")) {
    event.respondWith(redePrimeiro(request));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Eleva Chamados";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      icon: "/icons/192",
      badge: "/icons/96",
      data: { url: data.url || "/?aba=abertos" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alvo = (event.notification.data && event.notification.data.url) || "/?aba=abertos";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          client.postMessage({ type: "abrir-abertos" });
          return client.focus();
        }
      }
      return self.clients.openWindow(alvo);
    })(),
  );
});
