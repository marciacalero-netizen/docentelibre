/**
 * DOCENTE LIBRE — Worker del Asistente de Tesis
 *
 * Sirve el sitio estático y expone dos rutas privadas:
 *   POST /api/auth  -> comprueba la contraseña del asistente
 *   POST /api/chat  -> conversa con Claude (respuesta en streaming, SSE)
 *
 * Secretos necesarios en Cloudflare (nunca en el código):
 *   ANTHROPIC_API_KEY    clave de la API de Anthropic
 *   ASISTENTE_PASSWORD   contraseña de acceso al asistente
 */
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, instruccionRevision, contextoTesis } from './prompts.js';

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 32000;
const MAX_MENSAJES = 80;
const MAX_CARACTERES = 600000; // texto total de la conversación
const MAX_PDF_BASE64 = 14 * 1024 * 1024; // ~10 MB de PDF

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
      if (!mismoOrigen(request, url)) return json({ error: 'Origen no permitido.' }, 403);

      const acceso = await comprobarAcceso(request, env);
      if (acceso) return acceso;

      if (url.pathname === '/api/auth') return json({ ok: true });
      if (url.pathname === '/api/chat') return chat(request, env, ctx);
      return json({ error: 'Ruta no encontrada.' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

/* ---------- Acceso ---------- */

function mismoOrigen(request, url) {
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}

async function comprobarAcceso(request, env) {
  if (!env.ASISTENTE_PASSWORD) {
    return json({ error: 'El asistente aún no está configurado: falta el secreto ASISTENTE_PASSWORD.' }, 503);
  }
  const header = request.headers.get('Authorization') || '';
  const clave = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!(await iguales(clave, env.ASISTENTE_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 600)); // frena intentos repetidos
    return json({ error: 'Contraseña incorrecta.' }, 401);
  }
  return null;
}

// Comparación en tiempo constante (sobre los hashes de ambas cadenas).
async function iguales(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i] ^ y[i];
  return dif === 0;
}

/* ---------- Chat ---------- */

async function chat(request, env, ctx) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'Falta el secreto ANTHROPIC_API_KEY en Cloudflare.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Solicitud no válida.' }, 400);
  }

  const preparado = prepararMensajes(body);
  if (preparado.error) return json({ error: preparado.error }, 400);

  const system = [{ type: 'text', text: SYSTEM_PROMPT }];
  const contexto = contextoTesis(body.tesis);
  if (contexto) system.push({ type: 'text', text: contexto });

  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
  });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const enviar = (evento, datos) =>
    writer.write(enc.encode(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`));

  const trabajo = (async () => {
    try {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // Si el modelo principal declina una solicitud, la API la reintenta
          // en el modelo de respaldo dentro de la misma llamada.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          cache_control: { type: 'ephemeral' },
          output_config: { effort: body.modo === 'revision' ? 'high' : 'medium' },
          system,
          messages: preparado.messages,
        },
        { signal: request.signal }
      );

      stream.on('text', (delta) => {
        enviar('delta', { text: delta }).catch(() => {});
      });

      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        await enviar('error', { message: 'El modelo no pudo responder a esta solicitud. Reformule el pedido e inténtelo de nuevo.' });
      } else {
        await enviar('done', { stop_reason: final.stop_reason });
      }
    } catch (error) {
      await enviar('error', { message: mensajeDeError(error) }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();
  ctx.waitUntil(trabajo);

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

function prepararMensajes(body) {
  const entrada = Array.isArray(body?.messages) ? body.messages : null;
  if (!entrada || !entrada.length) return { error: 'No hay mensajes que enviar.' };
  if (entrada.length > MAX_MENSAJES) return { error: 'La conversación es demasiado larga. Inicie una nueva.' };

  let total = 0;
  const messages = [];
  for (const m of entrada) {
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
      return { error: 'Formato de mensajes no válido.' };
    }
    total += m.content.length;
    messages.push({ role: m.role, content: m.content });
  }
  if (total > MAX_CARACTERES) {
    return { error: 'El texto es demasiado largo para una sola revisión. Envíelo por capítulos.' };
  }
  if (messages[messages.length - 1].role !== 'user') return { error: 'El último mensaje debe ser suyo.' };

  // En modo revisión, el último mensaje es el texto a revisar: se le antepone
  // la consigna del tipo de revisión y, si lo hay, el PDF adjunto.
  if (body.modo === 'revision') {
    const ultimo = messages[messages.length - 1];
    const bloques = [];
    if (typeof body.pdf === 'string' && body.pdf) {
      if (body.pdf.length > MAX_PDF_BASE64) return { error: 'El PDF supera el tamaño máximo (10 MB).' };
      bloques.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: body.pdf },
      });
    }
    bloques.push({ type: 'text', text: `${instruccionRevision(body.revision)}\n\n${ultimo.content}` });
    ultimo.content = bloques;
  }
  return { messages };
}

function mensajeDeError(error) {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'La clave de la API de Anthropic no es válida. Revise el secreto ANTHROPIC_API_KEY en Cloudflare.';
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'La clave de la API no tiene permiso para usar este modelo.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Se alcanzó el límite de uso de la API. Espere un momento e inténtelo de nuevo.';
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `La API rechazó la solicitud: ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'No se pudo conectar con la API de Anthropic. Inténtelo de nuevo.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Error de la API (${error.status ?? 'sin código'}). Inténtelo de nuevo en unos minutos.`;
  }
  return 'Ocurrió un error inesperado al generar la respuesta.';
}

function json(datos, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
