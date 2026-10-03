# Piloto — Centro ProSalud (Guayaquil)

Instancia de MediConnect AI para **un solo centro** (uso interno, sin comercializar). El asistente se presenta como **SALUD**, el asistente virtual de *Centro ProSalud*. Canal: solo WhatsApp (sin llamadas ni voz).

## Cómo se trata cada servicio

| Servicio | Tipo | Qué hace el agente |
|---|---|---|
| Medicina General, Pediatría, Cardiología, Optometría, Psicología, Ginecología, Dermatología, Traumatología | **Con cita** | Agenda, reagenda, cancela y consulta disponibilidad con los médicos cargados en el panel. |
| 🦷 Odontología (Fresh Dental) | **Atención directa con el área** | No agenda. Responde: *«Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarte directamente con el área correspondiente.»* con **1. Continuar con 🦷 Odontología** / **2. Volver al menú**. Al continuar entrega el **enlace al WhatsApp propio del área** (con un mensaje inicial ya escrito). No se piden datos ni consentimiento y no se guarda nada del paciente. |
| 🧪 Laboratorio Clínico (Ecoprolab) | **Atención directa con el área** | Informa: sin cita, lunes a sábado de 7:00 a. m. a 2:00 p. m. (incluye retiro de exámenes); la *recepción de pruebas* es hasta las 10:00 a. m. Ofrece continuar con la recepcionista del laboratorio → enlace al WhatsApp de Ecoprolab. |
| 🩻 Imágenes y Rayos X (Ecoprolab) | **Atención directa con el área** | Informa que es sin cita y deriva al **mismo WhatsApp de Ecoprolab**. |
| 💉 Procedimientos Clínicos | **Atención directa con el área** | Deriva al área. *Aún sin número propio*: mientras no se cargue, la conversación pasa a una persona de ProSalud en el panel, marcada «Procedimientos Clínicos». |

**Cómo funciona la derivación:** el paciente siempre escribe al WhatsApp de ProSalud. Si el área tiene número propio cargado (*Especialidades y servicios → WhatsApp propio del área*), el agente entrega el enlace y registra una alerta informativa «Paciente derivado al WhatsApp de …» (se cuenta en Estadísticas como *derivadas a un área*). Si no tiene número, la conversación pasa a una persona en el panel.

**Resultados:** el agente **nunca envía resultados por WhatsApp**. Ante «mis resultados» explica que se retiran con cédula o se envían al correo registrado, y que el tiempo de entrega depende del examen y lo confirma la recepcionista del laboratorio. (Se retiró la frase «desde las 5:00 p. m.» del texto anterior porque contradice la atención de 7 a. m. a 2 p. m.; se puede reponer si se confirma). Pedir que se *interpreten* resultados sigue recibiendo la respuesta de no-diagnóstico.

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
- [ ] **WhatsApp propio de cada área** (Especialidades y servicios → editar → *WhatsApp propio del área*): Odontología (Fresh Dental), Laboratorio Clínico y Imágenes y Rayos X (ambos Ecoprolab, mismo número) y, si lo hay, Procedimientos Clínicos. Los números **no están en el repositorio** a propósito; verifique cada dígito al digitarlos.
- [ ] **Resultados de laboratorio**: si se confirma una hora de entrega general, añadirla al texto en Configuración. Ojo: el texto anterior decía «desde las 5:00 p. m.», que no cuadra con atención hasta las 2:00 p. m.
- [ ] **Imágenes y Rayos X**: horario y qué estudios son sin cita (editar el mensaje del servicio).
- [ ] Enlace de Google Maps (opcional) y revisar textos con el equipo.

## Antes de atender pacientes reales

Este prototipo **no está listo** para datos de pacientes reales hasta cubrir:
1. **Etapa 1 (ya posible):** el personal usa el *Simulador* y revisa *Conversaciones* y *Alertas* durante unos días, ajustando textos y flujos.
2. **HTTPS y alojamiento** estable (hoy escucha solo en `127.0.0.1`), copias de seguridad y cifrado en reposo.
3. **Revisión legal LOPDP** (aviso de consentimiento, responsable/encargado del tratamiento, delegado de protección de datos) y **revisión médica** de las reglas de emergencia.
4. **WhatsApp Business Platform:** cuenta de Meta Business verificada, decidir número (nuevo o el actual; verificar con Meta las condiciones vigentes si el número ya se usa en la app de WhatsApp Business), envío saliente y plantillas de recordatorio. Requiere su autorización; no se ha contratado nada.
5. MFA para el personal y sesiones persistentes (ver `docs/ARQUITECTURA.md`, sección 9).
