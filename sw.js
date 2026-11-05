// 앱 설치용 서비스 워커
// 화면 파일은 매번 서버에 "바뀌었나" 물어본다 (cache: no-cache, 안 바뀌었으면 304 로 가볍게).
// 인터넷이 안 되면 저장해 둔 것으로 연다.
const CACHE = "gagyebu-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Supabase 자료는 건드리지 않음
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
