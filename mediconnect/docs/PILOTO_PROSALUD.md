# Piloto — Centro ProSalud (Guayaquil)

Instancia de MediConnect AI para **un solo centro** (uso interno, sin comercializar). El asistente se presenta como **SALUD**, el asistente virtual de *Centro ProSalud*. Canal: solo WhatsApp (sin llamadas ni voz).

## Cómo se trata cada servicio

| Servicio | Tipo | Qué hace el agente |
|---|---|---|
| Medicina General, Pediatría, Cardiología, Optometría, Psicología, Ginecología, Dermatología, Traumatología | **Con cita** | Agenda, reagenda, cancela y consulta disponibilidad con los médicos cargados en el panel. |
| 🦷 Odontología | **Atención directa con el área** | No agenda. Responde: *«Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarte directamente con el área correspondiente.»* con las opciones **1. Continuar con 🦷 Odontología** / **2. Volver al menú**. Al continuar, la conversación pasa a una persona y queda marcada «Odontología» en el panel (si es fuera de horario, además avisa a guardia). No se piden datos ni consentimiento. |
| 🧪 Laboratorio Clínico | **Sin cita** | Informa: atención sin cita de lunes a sábado, 7:00–10:00 a. m., y cómo se entregan los resultados. Nunca agenda; ofrece pasar a una persona del área. |
| 🩻 Imágenes y Rayos X | **Sin cita** | Informa que es sin cita y ofrece pasar al área para confirmar horario y estudios (**horario por confirmar**). |
| 💉 Procedimientos Clínicos | Con cita (provisional) | Aparece en la lista de servicios; no se agenda hasta cargar médicos o cambiarlo de tipo. |

**Resultados:** el agente **nunca envía resultados por WhatsApp**. Ante «mis resultados» explica que se retiran en recepción con cédula o se envían al correo registrado, y que muchos resultados de laboratorio están listos el mismo día desde las 5:00 p. m. *«según el examen»* (redacción prudente hasta confirmar si aplica a todos). Pedir que se *interpreten* resultados sigue recibiendo la respuesta de no-diagnóstico.

Los tipos, emojis, palabras clave y mensajes propios se editan en el panel: **Especialidades y servicios** (solo administrador).

## Puesta en marcha (Windows, Mac o Linux; requiere Node.js 22.18+)

```bash
cd mediconnect
npm run setup:prosalud -- correo@delcentro.com "Nombre del administrador"   # crea data/prosalud.db y muestra una contraseña temporal
npm run start:prosalud                                                      # http://127.0.0.1:3000
```

- `setup:prosalud` toma los datos de [`config/prosalud.json`](../config/prosalud.json) y **nunca sobrescribe** una base existente.
- La base real es `data/prosalud.db`; la demostración (`npm start`) usa otra y no se mezclan. La pantalla de ingreso del piloto **no** muestra cuentas de demostración.
- Haga copias de seguridad de `data/prosalud.db` (con el servidor detenido, copiar el archivo y los `-wal`/`-shm` si existen).

## Pendiente de completar (desde el panel, salvo indicación)

- [ ] **Horario de recepción** (Configuración). Mientras esté vacío el agente no afirma «fuera de horario» y dice que aún no tiene el horario cargado.
- [ ] **Médicos**: nombre, especialidad, días/horas y duración de cita (Médicos). Sin médicos, el agente no puede agendar.
- [ ] **Precios** por especialidad o médico (Especialidades / Médicos). Sin precio responde «consulta con recepción».
- [ ] **Guardia fuera de horario**: nombre y WhatsApp (Configuración).
- [ ] **Usuarios de recepción** (Configuración → Usuarios).
- [ ] **Rayos X e Imágenes**: horario y qué estudios son sin cita (editar el mensaje del servicio).
- [ ] **Laboratorio**: confirmar si «resultados el mismo día desde las 5:00 p. m.» aplica a todos los exámenes. *Nota:* el perfil de WhatsApp Business de Ecoprolab muestra atención de 7:00 a. m. a 2:00 p. m.; el texto actual dice «sin cita de 7:00 a 10:00 a. m.». Confirmar cuál es el correcto.
- [ ] **Procedimientos Clínicos**: ¿con cita, sin cita o directo con el área?
- [ ] **Odontología y Laboratorio tienen WhatsApp propio** (Fresh Dental y Ecoprolab). Decidir si, al «continuar», la conversación la atiende el personal de ProSalud desde este panel (como está hoy) o si se entrega el enlace al WhatsApp del área.
- [ ] Enlace de Google Maps (opcional) y revisar textos con el equipo.

## Antes de atender pacientes reales

Este prototipo **no está listo** para datos de pacientes reales hasta cubrir:
1. **Etapa 1 (ya posible):** el personal usa el *Simulador* y revisa *Conversaciones* y *Alertas* durante unos días, ajustando textos y flujos.
2. **HTTPS y alojamiento** estable (hoy escucha solo en `127.0.0.1`), copias de seguridad y cifrado en reposo.
3. **Revisión legal LOPDP** (aviso de consentimiento, responsable/encargado del tratamiento, delegado de protección de datos) y **revisión médica** de las reglas de emergencia.
4. **WhatsApp Business Platform:** cuenta de Meta Business verificada, decidir número (nuevo o el actual; verificar con Meta las condiciones vigentes si el número ya se usa en la app de WhatsApp Business), envío saliente y plantillas de recordatorio. Requiere su autorización; no se ha contratado nada.
5. MFA para el personal y sesiones persistentes (ver `docs/ARQUITECTURA.md`, sección 9).
