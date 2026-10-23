const CACHE_NAME = "medclass-v3"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Nunca cacheia uma resposta redirecionada: se um GET (ex.: /dashboard
// deslogado) for redirecionado pelo middleware para /login, o fetch() já
// segue o redirect e devolve uma Response com redirected=true. Servir essa
// resposta depois para uma requisição de navegação faz o Chrome recusar
// com "Response served by service worker has redirections" e a página cai
// no error boundary. Sempre checar response.redirected antes de guardar.
function cacheIfOk(request, response) {
  if (response && response.status === 200 && !response.redirected) {
    const clone = response.clone()
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
  }
  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  if (request.url.includes("/api/") || request.url.includes("supabase")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Navegação entre páginas: sempre busca na rede primeiro. Isso evita
  // servir HTML desatualizado ou uma resposta de redirect cacheada por
  // engano, e só cai pro cache se a rede estiver realmente offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => cacheIfOk(request, response))
        .catch(() => caches.match(request))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => cacheIfOk(request, response))
      return cached || fetched
    })
  )
})
