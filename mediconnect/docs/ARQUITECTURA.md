# MediConnect AI — Arquitectura técnica y fases de desarrollo

> Plataforma comercial (SaaS multiempresa) de atención automatizada **exclusivamente por WhatsApp** para clínicas y consultorios.
> **Fuera de alcance, por decisión de producto:** llamadas telefónicas, telefonía VoIP, reconocimiento de voz y transferencia de llamadas. Nada de eso existe en el código. El personal de guardia se avisa por WhatsApp/alerta, nunca por llamada.

## 1. Visión general

```
 Paciente ──WhatsApp──▶ WhatsApp Business Platform (Meta Cloud API)        [Fase 1]
                              │  webhook firmado (X-Hub-Signature-256)
                              ▼
                     ┌──────────────────┐   phone_number_id → clínica (tenant)
                     │ Canal (adaptador)│   src/channels/whatsapp.ts
                     └────────┬─────────┘
                              ▼
        ┌─────────────────── Agente conversacional ───────────────────┐
        │ 1. safety.ts   emergencias / autolesión / no-diagnóstico      │  ← SIEMPRE primero
        │ 2. nlu.ts      intenciones y entidades (reglas; LLM opcional) │
        │ 3. engine.ts   máquina de estados: consentimiento, agendar,   │
        │                reagendar, cancelar, disponibilidad, info,     │
        │                derivación a humano, confirmación              │
        └───────────────┬─────────────────────────────┬───────────────┘
                        ▼                             ▼
          Servicios de dominio (por clínica)     Alertas al personal
          availability · appointments ·          (emergencia, derivación,
          reminders · stats                      guardia fuera de horario)
                        ▼
                 Base de datos (SQLite en demo → PostgreSQL con RLS en producción)
                        ▲
          API REST /api (sesión por cookie, roles)  ◀──  Panel web en español (responsive)
                                                          + Simulador de WhatsApp
```

En esta primera versión el canal real **no está conectado**: el *simulador* del panel invoca el mismo `handleIncoming()` que usará el webhook. Así el comportamiento que se prueba hoy es el que se desplegará mañana.

## 2. Multiempresa y separación segura de datos

Modelo elegido: **una base compartida, filas separadas por `clinic_id`** (pool model). Es el más económico de operar al vender a muchas clínicas; la seguridad se obtiene por capas:

| Capa | Mecanismo en el código |
|---|---|
| Identidad del tenant | `clinic_id` sale **siempre de la sesión** (`server.ts`), nunca de parámetros de la solicitud. En WhatsApp sale del `phone_number_id` que recibe el mensaje. |
| Capa de servicios | Toda función de dominio recibe `clinicId` y lo incluye en cada `WHERE`. |
| Base de datos | Llaves foráneas **compuestas** `(clinic_id, id)`: una cita de la clínica A no puede referenciar un médico o paciente de la B aunque haya un bug. |
| Pruebas | `test/api.test.ts` intenta leer, modificar y crear datos de otra clínica por id directo y debe fallar (404/409/400). |
| Producción (fase 2) | PostgreSQL con **Row-Level Security** (`USING (clinic_id = current_setting('app.clinic_id')::int)`) como segunda barrera independiente del código de aplicación. |
| Configuración propia | Cada clínica tiene su nombre, dirección, horarios, precios, especialidades, médicos, guardia, número de emergencias, recordatorios y ventana de reserva (`clinics.settings`). |

Roles: **administrador** (todo: médicos, especialidades, configuración, usuarios, estadísticas, anonimización) y **recepcionista** (calendario, pacientes, conversaciones, alertas).

## 3. Modelo de datos

`clinics` · `users` (rol) · `specialties` · `doctors` · `schedules` (bloques semanales) · `patients` (teléfono, nombre, consentimiento) · `appointments` · `conversations` (estado del agente, derivación, bandera de emergencia) · `messages` (historial) · `notifications` (alertas/guardia) · `audit_log` (lecturas y cambios sensibles).

Minimización de datos: del paciente **solo** se guardan *nombre* y *número de WhatsApp*. No existen campos de motivo de consulta, síntomas, diagnóstico ni cédula.

## 4. El agente

**Capacidades:** atención 24/7; agendar, reagendar y cancelar; disponibilidad por médico y especialidad; información de especialidades, médicos, horarios, precios y ubicación; confirmación de asistencia por respuesta al recordatorio; derivación a recepcionista; aviso a guardia fuera de horario.

**Seguridad clínica (`safety.ts`, se evalúa antes que cualquier intención):**
- *Emergencia* (dolor de pecho, no respira, desmayo, convulsión, hemorragia, accidente, ictus, intoxicación…) → indica llamar al **911 (ECU 911)**, marca la conversación 🚨, crea alerta urgente y, fuera de horario, la dirige al WhatsApp de guardia. Funciona incluso si un humano atiende la conversación.
- *Riesgo de autolesión* → mensaje de contención + 911 + alerta urgente.
- *Petición clínica* (qué tengo, qué medicamento, dosis, interpretar resultados) → **no diagnostica**, no pide detalles clínicos, ofrece agendar y recuerda el 911 si es grave.
- Los patrones son deliberadamente conservadores (ante la duda, orientar a emergencias) y deben ampliarse con asesoría médica antes de producción.

**Consentimiento:** antes de registrar cualquier dato personal se muestra el aviso (finalidad, base legal LOPDP, derechos, que no se pedirán datos médicos) y se exige un *SI* explícito; queda `consent_at` + `consent_version`. Sin consentimiento solo se da información general.

**Derivación a humano:** `status = human` → el bot calla (salvo emergencias) hasta que el personal pulse *Devolver al agente*. Dentro de horario: «un recepcionista te escribirá». Fuera de horario: alerta `oncall` al WhatsApp de guardia + mensaje al paciente.

**Recordatorios:** cada minuto se buscan citas dentro de `reminder_hours`; se escribe el mensaje en la conversación y se marca `reminder_sent`. El paciente responde *CONFIRMO / REAGENDAR / CANCELAR*.

**Extensión con LLM (fase 3):** se sustituye solo la comprensión de lenguaje (`detectIntent` y extracción de entidades) por un modelo con salida estructurada. `safety.ts` sigue ejecutándose antes y las operaciones de citas siguen siendo código determinista con validación; el modelo nunca escribe en la base de datos directamente.

## 5. Integración con WhatsApp Business Platform (fase 1)

Ya existe `src/channels/whatsapp.ts` (deshabilitado por defecto con `WHATSAPP_ENABLED`): verificación del webhook, **validación de firma HMAC**, extracción de mensajes y mapeo `phone_number_id → clínica`. Falta, y requiere autorización del cliente:
1. Cuenta de Meta Business verificada y número por clínica (o *Embedded Signup* para onboarding autoservicio).
2. Token de acceso **por clínica** en un gestor de secretos (nunca en la base en claro).
3. Envío saliente (`sendText`) y **plantillas aprobadas** para recordatorios y avisos fuera de la ventana de 24 h.
4. Cola de entrada/salida con reintentos, idempotencia por `messageId` y límites de tasa.
5. Registro del *opt-in* del paciente exigido por las políticas de WhatsApp.

## 6. Seguridad y protección de datos (Ecuador)

Los datos de salud son **datos sensibles** bajo la Ley Orgánica de Protección de Datos Personales (LOPDP); esto no es asesoría legal: antes de operar con pacientes reales, la empresa y cada clínica deben validar con un abogado el aviso de privacidad, el contrato de encargado de tratamiento, la designación del delegado de protección de datos y las medidas de seguridad exigibles.

Implementado: consentimiento explícito y versionado · minimización · derecho de supresión (*Anonimizar*: borra nombre, teléfono y contenido de mensajes; cancela citas futuras) · auditoría de accesos · contraseñas con scrypt · sesión HttpOnly + SameSite=Strict · cabecera anti-CSRF · CSP y cabeceras de seguridad · límite de intentos de login · consultas parametrizadas · el servidor escucha solo en `127.0.0.1` por defecto.

Pendiente para producción: TLS, cifrado en reposo y de copias de seguridad, MFA para el personal, restablecimiento de contraseña, sesiones persistentes (Redis/BD), política de retención y borrado automático, registro de incidentes, rotación de secretos, pruebas de penetración.

## 7. Decisiones técnicas de esta versión

- **Node.js 22 + TypeScript sin dependencias** (`node:http`, `node:sqlite`, ejecución directa de `.ts`): se ejecuta con un solo comando y no contrata servicios externos. `typescript` y `@types/node` son solo de desarrollo (verificación de tipos).
- **SQLite** para la demo; el esquema es SQL estándar y se migra a **PostgreSQL** en la fase 2.
- **Panel en JavaScript puro** (sin build), diseño responsive: barra lateral en escritorio y menú desplegable en celular.
- Horas de citas guardadas en **hora local de la clínica** (`America/Guayaquil`, sin horario de verano) para simplificar la demo.

## 8. Fases de desarrollo

| Fase | Contenido | Estado |
|---|---|---|
| **0 — Prototipo** | Agente por reglas, simulador, panel (calendario, pacientes, médicos, especialidades, conversaciones, alertas, estadísticas, configuración), multiempresa, roles, datos ficticios, pruebas automáticas. | ✅ Esta entrega |
| **1 — Piloto con WhatsApp real** | Cuenta Meta Business, webhook público (previa autorización), envío y plantillas, cola con reintentos, TLS, hosting, 1–2 clínicas piloto, ajuste de textos con recepcionistas. | Pendiente |
| **2 — Producción multiempresa** | PostgreSQL + RLS, sesiones persistentes, MFA y recuperación de contraseña, alta de clínicas (onboarding), facturación/planes, copias de seguridad, observabilidad, auditoría ampliada, revisión legal LOPDP. | Pendiente |
| **3 — Lenguaje natural con LLM** | Comprensión flexible (fechas libres, varios pacientes por teléfono, mensajes largos), evaluación continua con casos de seguridad, mismos guardarraíles. | Pendiente |
| **4 — Integraciones** | Calendarios externos, sistema de historia clínica/HIS de la clínica, pagos o pre-pagos, encuestas de satisfacción, lista de espera. | Pendiente |

## 9. Limitaciones conocidas de la versión 0

- Sin conexión a WhatsApp: el envío real, las plantillas y el opt-in no están implementados.
- Sesiones del panel en memoria (se pierden al reiniciar); sin MFA ni recuperación de contraseña.
- Un paciente por número de WhatsApp (no se agenda a familiares con nombres distintos).
- Detección de emergencias por patrones de texto: puede fallar con jerga, errores ortográficos o negaciones («no tengo dolor de pecho» también dispara). Debe revisarla personal médico.
- Los recordatorios se registran en la conversación; no usan plantillas de WhatsApp.
- Sin manejo de feriados ni de ausencias puntuales de un médico (solo horario semanal e *Inactivo*).
- Los datos de la demo se regeneran con `npm run seed`.
