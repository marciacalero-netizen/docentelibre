# MediConnect AI

Agente de atención por **WhatsApp** para clínicas y consultorios (multiempresa), con panel administrativo y simulador de conversaciones.
Primera versión funcional con **datos 100 % ficticios**. No se conecta a WhatsApp ni a ningún servicio externo, y no hace despliegues.

> Sin llamadas, VoIP, reconocimiento de voz ni transferencia de llamadas: el canal es solo WhatsApp.

📐 Arquitectura y fases de desarrollo: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
🏥 **Piloto del Centro ProSalud** (Guayaquil): [`docs/PILOTO_PROSALUD.md`](docs/PILOTO_PROSALUD.md) — `npm run setup:prosalud` y `npm run start:prosalud`

## Requisitos

- **Node.js 22.18 o superior** (`node -v`). No hace falta instalar paquetes para ejecutarlo.
- Opcional: `npm install` solo para la verificación de tipos (`npm run typecheck`).

## Ejecutar

```bash
cd mediconnect
npm start
```

Abre **http://127.0.0.1:3000**. La primera vez crea la base `data/mediconnect.db` con datos de demostración
(para regenerarla desde cero: `npm run seed`). Puerto distinto: `PORT=3100 npm start`.

### Cuentas de demostración (contraseña `Demo1234!`)

| Correo | Clínica | Rol |
|---|---|---|
| `admin@santalucia.demo` | Clínica Santa Lucía (Guayaquil) | Administrador |
| `recepcion@santalucia.demo` | Clínica Santa Lucía | Recepcionista |
| `admin@medisur.demo` | Consultorios MediSur (Guayaquil) | Administrador |

La pantalla de ingreso tiene botones que rellenan estas cuentas.

## Qué probar (recorrido sugerido)

1. **Simulador** (menú *Simulador WhatsApp*): escribe como un paciente.
   - `Hola` → `4` (Agendar una cita) → acepta el consentimiento con `SI` → elige especialidad, médico y horario → escribe nombre y apellido → `SI`.
   - Luego `reagendar mi cita` y `cancelar mi cita`.
   - **Familiares:** escribe `agendar` → opción *Para otra persona* → nombre y apellido del familiar. Las citas, recordatorios y cancelaciones se manejan por persona bajo el mismo número (máx. 6 familiares).
   - `¿Hay turno con pediatría?`, `¿cuánto cuesta la consulta?`, `¿dónde están ubicados?`, `horarios`.
   - **Seguridad:** `Tengo dolor fuerte en el pecho` (emergencia → 911 + alerta) y `¿qué tengo si me duele la cabeza?` (no diagnostica).
   - **Humano:** `Quiero hablar con una persona`. Ve a *Conversaciones*, abre la conversación, respóndele como recepción y mira la respuesta en el simulador; luego *Devolver al agente*.
   - **Recordatorios:** agenda una cita para hoy o mañana (dentro de las horas configuradas) y pulsa *Ejecutar recordatorios ahora*; responde `CONFIRMO`.
   - Los botones rápidos bajo el chat envían estos mensajes por ti.
2. **Calendario:** vista semanal por médico, nueva cita manual, reagendar, cancelar, marcar atendida / no asistió.
3. **Pacientes, Médicos, Especialidades:** el administrador edita precios, horarios semanales y estado; el recepcionista solo consulta.
4. **Alertas:** emergencias detectadas, derivaciones y avisos a guardia (envío por WhatsApp simulado). Para ver el aviso fuera de horario, cambia el horario en *Configuración* o prueba fuera del horario de la clínica.
5. **Estadísticas** (solo administrador) y **Configuración** (datos, horarios, guardia, recordatorios, usuarios).
6. **Multiempresa:** cierra sesión e ingresa como `admin@medisur.demo`: otra clínica, otros médicos, precios, pacientes y conversaciones. Ninguna ve los datos de la otra.
7. **Celular:** reduce el ancho de la ventana (o abre la URL desde el móvil si publicas el puerto en tu red); el menú pasa a ☰.

## Pruebas automáticas

```bash
npm test          # 38 pruebas: agente, familiares, servicios especiales (Odontología/Laboratorio), setup del piloto, seguridad clínica, recordatorios, aislamiento entre clínicas, roles, CSRF
npm run typecheck # requiere `npm install` previo
```

Cubren, entre otras cosas: emergencias y no-diagnóstico, consentimiento previo a guardar datos, flujo completo agendar → reagendar → cancelar, que no haya doble reserva, agendar para familiares bajo un mismo número (sin duplicar personas ni mezclar citas), derivación a humano y aviso a guardia fuera de horario, y que una clínica **no pueda leer ni modificar** datos de otra por id directo.

## Estructura

```
src/agent/        safety.ts (emergencias/no-diagnóstico) · nlu.ts (intenciones) · engine.ts (flujos)
src/services/     availability · appointments · reminders · stats · conversations · clinic · notify
src/channels/     whatsapp.ts  → adaptador de WhatsApp Business Platform (deshabilitado, fase 1)
src/server.ts     API REST + archivos estáticos      src/db.ts  esquema (llaves compuestas por clínica)
src/setup-prosalud.ts + config/prosalud.json  → base del piloto del Centro ProSalud
src/seed.ts       datos ficticios                    public/    panel web (HTML + CSS + JS, sin build)
test/             pruebas con node:test              docs/      arquitectura y fases
```

## Seguridad y privacidad en esta versión

Consentimiento explícito antes de guardar datos · solo se guardan nombre y WhatsApp (nada clínico) · derecho de supresión (*Anonimizar* en la ficha del paciente) · roles administrador/recepcionista · contraseñas con scrypt · cookie HttpOnly + SameSite · CSP · auditoría de accesos · el servidor escucha solo en `127.0.0.1`.

**No usar con pacientes reales todavía:** faltan TLS, MFA, cifrado en reposo, revisión legal (LOPDP de Ecuador) y revisión médica de las reglas de emergencia. Detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md#9-limitaciones-conocidas-de-la-versión-0).

## Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT`, `HOST` | `3000`, `127.0.0.1` | Dirección del servidor |
| `MEDICONNECT_DB` | `data/mediconnect.db` | Ruta de la base SQLite |
| `WHATSAPP_ENABLED` | *(apagado)* | Habilita el webhook `/webhook/whatsapp` (fase 1; requiere además `WHATSAPP_VERIFY_TOKEN` y `WHATSAPP_APP_SECRET`) |
