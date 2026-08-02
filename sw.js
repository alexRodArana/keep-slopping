const CACHE_NAME = 'keep-slopping-v8'
const CORE_ASSETS = ['./', './manifest.webmanifest', './keep-slopping-icon.svg', './app-icon-192.png', './app-icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)

  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) {
          return cached
        }

        if (event.request.mode === 'navigate') {
          return (await caches.match('./')) ?? Response.error()
        }

        return Response.error()
      }),
  )
})
