// Service worker minimo: solo habilita "agregar a pantalla de inicio".
// No cachea la API a proposito, para que el estado siempre sea en vivo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
