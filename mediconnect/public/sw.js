'use strict';
// Service worker del panel: muestra los avisos (Web Push) cuando un paciente espera respuesta.
// El aviso llega sin contenido; aquí solo se cuenta cuántos chats esperan. Nunca se muestran nombres
// ni mensajes del paciente, porque la notificación puede verse con la pantalla bloqueada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => e.waitUntil((async () => {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (wins.some((w) => w.focused)) return;   // el panel está en pantalla: ahí ya suena
  let n = 0;
  try { const r = await fetch('/api/summary', { credentials: 'same-origin' }); if (r.ok) n = ((await r.json()).waiting_human || []).length; } catch { /* sin sesión: aviso genérico */ }
  await self.registration.showNotification('MediConnect · Gia', {
    body: n > 1 ? `Hay ${n} chats esperando respuesta de recepción.` : 'Un paciente espera respuesta de recepción.',
    tag: 'mc-espera', renotify: true, requireInteraction: true, vibrate: [300, 150, 300, 150, 300],
    icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/#/conversaciones' },
  });
})()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((c) => new URL(c.url).origin === self.location.origin);
    if (w) { await w.focus(); return w.navigate('/#/conversaciones').catch(() => undefined); }
    return self.clients.openWindow('/#/conversaciones');
  })());
});
