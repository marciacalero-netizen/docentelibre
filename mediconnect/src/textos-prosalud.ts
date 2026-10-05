// Genera docs/TEXTOS_PROSALUD.md: todos los mensajes que ve el paciente, ejecutando el agente real
// contra una base temporal del Centro ProSalud. Los datos marcados [EJEMPLO] son ficticios.
// Uso: npm run textos:prosalud
import { readFileSync, writeFileSync } from 'node:fs';
import { openDb, one, run } from './db.ts';
import { DEFAULT_SETTINGS, getClinic } from './services/clinic.ts';
import { handleIncoming } from './agent/engine.ts';
import { runRemindersForClinic } from './services/reminders.ts';
import { addDays, addMinutes, nowIso, nowLocal, weekday } from './util.ts';

const cfg = JSON.parse(readFileSync(new URL('../config/prosalud.json', import.meta.url), 'utf8'));
const db = openDb(':memory:');
const settings = {
  ...DEFAULT_SETTINGS, ...cfg.settings,
  oncall_name: 'Guardia [EJEMPLO]', oncall_whatsapp: '+593000000001',
};
const clinicId = Number(run(db, 'INSERT INTO clinics (name, slug, timezone, address, city, maps_url, settings, created_at) VALUES (?,?,?,?,?,?,?,?)',
  cfg.clinic.name, 'prosalud', cfg.clinic.timezone, cfg.clinic.address, cfg.clinic.city, 'https://maps.google.com/?q=[ENLACE-EJEMPLO]', JSON.stringify(settings), nowIso()).lastInsertRowid);
const spId = new Map<string, number>();
for (const s of cfg.specialties) {
  const contact = ['Odontología', 'Laboratorio Clínico', 'Imágenes y Rayos X'].includes(s.name) ? '+593000000000' : null;   // [EJEMPLO] número ficticio
  spId.set(s.name, Number(run(db, 'INSERT INTO specialties (clinic_id, name, description, price, kind, emoji, keywords, info, contact_whatsapp) VALUES (?,?,?,?,?,?,?,?,?)',
    clinicId, s.name, null, null, s.kind ?? 'appointment', s.emoji ?? null, s.keywords ?? null, s.info ?? null, contact).lastInsertRowid));
}
// Médicos y horarios REALES (Excel de atención particular), tal como los carga `npm run setup:prosalud`
for (const d of cfg.doctors ?? []) {
  const id = Number(run(db, 'INSERT INTO doctors (clinic_id, specialty_id, name, slot_minutes) VALUES (?,?,?,?)', clinicId, spId.get(d.specialty), d.name, d.slot_minutes ?? 30).lastInsertRowid);
  for (const b of d.schedule ?? []) for (const day of b.days) run(db, 'INSERT INTO schedules (clinic_id, doctor_id, weekday, start_time, end_time) VALUES (?,?,?,?,?)', clinicId, id, day, b.start, b.end);
}

const tz = cfg.clinic.timezone;
const today = nowLocal(tz).slice(0, 10);
let monday = addDays(today, 1); while (weekday(monday) !== 1) monday = addDays(monday, 1);
let sunday = addDays(today, 1); while (weekday(sunday) !== 0) sunday = addDays(sunday, 1);
const OPEN = `${monday}T10:00`, CLOSED = `${sunday}T22:00`;

let n = 0, phoneN = 0;
const out: string[] = [];
const quote = (t: string) => t.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n');
function scene(id: string, title: string, note: string | null, lines: string[], opts: { now?: string; phone?: string } = {}): string {
  const phone = opts.phone ?? `+5939900${String(++phoneN).padStart(5, '0')}`;
  out.push(`### ${id}. ${title}\n`);
  if (note) out.push(`_${note}_\n`);
  for (const l of lines) {
    const r = handleIncoming(db, clinicId, phone, l, { now: opts.now });
    out.push(`**Paciente:** ${l}\n`);
    if (!r.replies.length) out.push('_(el asistente no responde: la conversación la atiende una persona)_\n');
    for (const t of r.replies) { n++; out.push(`${quote(t)}\n`); }
  }
  out.push('**Observaciones del revisor:** ______________________________________________\n\n---\n');
  return phone;
}
const sec = (t: string) => out.push(`\n## ${t}\n`);

sec('A. Inicio y mensajes que no entiende');
scene('A1', 'Saludo y menú principal', `El nombre «${cfg.settings.assistant_name}» y el nombre del centro salen de Configuración.`, ['Hola']);
scene('A2', 'Mensaje que no entiende (se muestran las opciones una sola vez; si vuelve a no entender, se ofrece recepción)', null, ['asdf qwer', 'zzzz']);
scene('A3', 'Agradecimiento', null, ['muchas gracias']);

sec('B. Información general');
scene('B1', 'Especialidades y servicios (opción 1 del menú)', 'Se arma con la lista de «Especialidades y servicios» del panel.', ['hola', '1']);
scene('B2', 'Médicos y sus horarios', 'Datos reales del horario de atención particular (Excel). Un mismo profesional puede atender varios servicios.', ['¿qué médicos tienen?']);
scene('B3', 'Horario de recepción', 'Horario real: lunes a sábado de 8:00 a 18:00.', ['¿cuál es el horario?'], { now: OPEN });
scene('B4', 'Horario consultado fuera de horario', null, ['¿a qué hora atienden?'], { now: CLOSED });
scene('B5', 'Valores de la consulta', 'Aún no hay precios cargados: cuando se carguen en el panel, el asistente los mostrará por especialidad.', ['¿cuánto cuesta la consulta?']);
scene('B6', 'Ubicación', null, ['¿dónde están ubicados?']);
scene('B7', 'Horarios, precios y ubicación juntos (opción 2)', null, ['hola', '2'], { now: OPEN });

sec('C. Agendar una cita');
scene('C1', 'Primera cita de un paciente nuevo (consentimiento, nombre, especialidad, médico, horario)', 'Las fechas dependen del día en que se generó este documento.',
  ['Hola', '4', 'si', '1', 'maria fernanda zambrano', 'psicologia', '1', '1', 'si']);
scene('C2', 'El paciente NO acepta el consentimiento', null, ['quiero agendar una cita', 'no']);
scene('C3', 'Respuesta inválida en el consentimiento', null, ['quiero agendar una cita', 'quizás', 'tal vez']);
scene('C4', 'Nombre inválido, pedir más horarios y elegir otro horario', null, ['agendar', 'si', '1', '12345', 'Luis Pérez Mora', 'traumatologia', 'más', '1', 'no', '1', 'si']);
scene('C5', 'Servicio escrito en el mensaje inicial (el asistente lo recuerda y se salta la pregunta de especialidad)', null, ['quiero una cita con el psicólogo', 'si', '1', 'Pedro Gil Mora']);

sec('D. Familiares bajo un mismo número');
const pFam = scene('D1', 'El titular agenda para sí mismo', null, ['Hola', '4', 'si', '1', 'Carla Rivera Soto', 'psicologia', '1', '1', 'si']);
scene('D2', 'Luego agenda para un hijo (declaración de representante)', null, ['agendar', '2', 'Mateo Rivera Soto', 'traumatologia', '1', 'si'], { phone: pFam });
scene('D3', 'Ver todas las citas del número (aparecen por persona)', null, ['mis citas'], { phone: pFam });
scene('D4', 'Cancelar la cita de una de las personas', null, ['cancelar mi cita', '2', 'si'], { phone: pFam });

sec('E. Reagendar, cancelar y confirmar');
const pE = scene('E1', 'Preparación: una cita nueva', null, ['Hola', '4', 'si', '1', 'Rosa Vera Ruiz', 'psicologia', '1', '1', 'si']);
scene('E2', 'Reagendar', null, ['necesito reagendar mi cita', '2', 'si'], { phone: pE });
scene('E3', 'Cancelar (primero se responde NO, luego SI)', null, ['quiero cancelar mi cita', 'no', 'cancelar mi cita', 'si'], { phone: pE });
scene('E4', 'Consultar citas sin tener ninguna', null, ['mis citas'], { phone: pE });
scene('E5', 'Reagendar o cancelar sin citas', null, ['reagendar', 'cancelar'], { phone: `+5939900${String(++phoneN).padStart(5, '0')}` });

sec('F. Disponibilidad');
scene('F1', 'Disponibilidad de una especialidad con cita', null, ['¿hay turno con el psicólogo?']);
scene('F2', 'Disponibilidad sin decir la especialidad', null, ['ver disponibilidad', '1']);
scene('F3', 'Pediatría se atiende sin cita: el asistente informa los días y horas', null, ['¿hay turno con pediatría?']);
scene('F4', 'Medicina General', 'Tres médicos con distintos días y horas (datos del Excel).', ['medicina general', '1']);
scene('F5', 'Un servicio sin días cargados en el Excel (Dermatología)', 'El Excel no trae días ni horario de Dermatología ni de Cirugía Menor: el asistente lo dice y ofrece hablar con recepción.', ['dermatología']);
scene('F6', 'El paciente prefiere volver al menú', null, ['ginecología', '2']);

sec('G. Servicios de atención directa con el área (Odontología, Laboratorio, Rayos X, Procedimientos)');
scene('G1', 'Odontología: se deriva al WhatsApp del área', '[EJEMPLO] El número del enlace es ficticio; se carga en el panel.', ['quiero una cita con el dentista', '1']);
scene('G2', 'Odontología: el paciente prefiere volver al menú', null, ['odontología', '2']);
scene('G3', 'Laboratorio Clínico', 'Horario según lo indicado: 7:00 a. m.–2:00 p. m., recepción de pruebas hasta las 10:00 a. m.', ['¿atienden en el laboratorio?', '1']);
scene('G4', 'Imágenes y Rayos X', null, ['necesito una radiografía', '1']);
scene('G5', 'Procedimientos Clínicos (aún sin WhatsApp propio: pasa a una persona de ProSalud)', null, ['necesito un procedimiento clínico', '1', 'hola?'], { now: OPEN });
scene('G6', 'Servicio de área elegido desde la lista de agendar', null, ['agendar', 'si', '1', 'Mario Paz León', 'odontologia'], { });
scene('G7', 'Respuesta que no entiende dentro de un servicio de área', null, ['laboratorio', 'quizás', 'no sé']);

sec('H. Resultados de exámenes');
scene('H1', 'Pedir resultados por WhatsApp', null, ['¿me pueden mandar mis resultados por whatsapp?']);
scene('H2', 'Pedir que se interpreten resultados', null, ['¿me interpretas mis resultados? ¿es normal?']);

sec('I. Seguridad: emergencias, salud mental y diagnósticos');
scene('I1', 'Posible emergencia médica', 'El número 911 sale de Configuración. Además crea una alerta urgente para el personal.', ['Mi papá tiene dolor fuerte en el pecho y no puede respirar']);
scene('I2', 'Posible riesgo para la vida (salud mental)', null, ['ya no quiero vivir']);
scene('I3', 'Pide diagnóstico o medicamento', null, ['Me duele la cabeza hace días, ¿qué medicamento puedo tomar?']);
scene('I4', 'Cuenta un síntoma pero quiere agendar', null, ['Quiero agendar una cita, tengo fiebre']);

sec('J. Hablar con una persona');
scene('J1', 'Dentro del horario de recepción', null, ['quiero hablar con una persona', 'hola?', 'gracias'], { now: OPEN });
scene('J2', 'Fuera del horario (se avisa al personal de guardia)', '[EJEMPLO] Con el WhatsApp de guardia cargado se le envía un aviso (en esta versión el aviso queda registrado en el panel).', ['recepcionista por favor'], { now: CLOSED });
scene('J3', 'Emergencia mientras lo atiende una persona', 'La alerta de emergencia siempre se envía, aunque el asistente esté en silencio.', ['recepción', 'ahora mismo no puede respirar'], { now: OPEN });

sec('K. Recordatorio de cita');
const pK = `+5939900${String(++phoneN).padStart(5, '0')}`;
for (const l of ['Hola', '4', 'si', '1', 'Elena Cruz Paz', 'psicologia', '1', '1', 'si']) handleIncoming(db, clinicId, pK, l);
const clinic = getClinic(db, clinicId)!;
run(db, `UPDATE appointments SET start_at = ?, end_at = ? WHERE id = (SELECT MAX(id) FROM appointments)`, addMinutes(nowLocal(tz), 300), addMinutes(nowLocal(tz), 320));
runRemindersForClinic(db, clinic);
const rem = one<{ body: string }>(db, `SELECT body FROM messages WHERE kind = 'reminder' ORDER BY id DESC`)!;
out.push('### K1. Recordatorio automático\n\n_Se envía antes de la cita según «Recordatorio (horas antes)» de Configuración. En WhatsApp real debe enviarse con una plantilla aprobada por Meta, cuyo texto se revisará aparte._\n');
n++; out.push(`${quote(rem.body)}\n`);
out.push('**Observaciones del revisor:** ______________________________________________\n\n---\n');
scene('K2', 'El paciente responde CONFIRMO', null, ['CONFIRMO'], { phone: pK });

const header = `# Textos que ve el paciente — Centro ProSalud (asistente ${cfg.settings.assistant_name})

> Documento **generado automáticamente** ejecutando el asistente real (${n} mensajes). Si se cambia algún texto, se vuelve a generar con \`npm run textos:prosalud\`.

## Cómo revisarlo

1. Lea cada escenario como si fuera el paciente. Las líneas **Paciente:** son lo que escribe; las citas con \`>\` son lo que responde el asistente, **tal como llegará por WhatsApp**.
2. En WhatsApp, \`*texto*\` se ve en **negrita** y \`_texto_\` en _cursiva_; aquí se muestran con los asteriscos para que sea el texto exacto.
3. Anote correcciones en **Observaciones del revisor** (tono, datos incorrectos, cosas que falta decir o que sobran).
4. Marque con ✅ lo aprobado y con ✏️ lo que se debe cambiar.

## Datos de ejemplo (NO son reales)

Este documento usa una base temporal con los **médicos, horarios, dirección y horario de recepción reales** del centro. Son **ficticios** y no deben revisarse: el nombre de la persona de guardia, el enlace de mapa y los números de WhatsApp de las áreas (los enlaces \`wa.me/593000000000\`). Los **precios** todavía no están cargados. Las **fechas de las citas** corresponden al día en que se generó el documento.

## Dónde se cambia cada texto

| Texto | Dónde se cambia |
|---|---|
| Nombre del asistente (${cfg.settings.assistant_name}), respuesta sobre resultados, número de emergencias, horario, guardia | Panel → Configuración |
| Mensaje de Laboratorio, Rayos X, Odontología y Procedimientos; WhatsApp de cada área; emoji y palabras clave | Panel → Especialidades y servicios |
| Dirección | Panel → Configuración |
| El resto (saludo, menú, consentimiento, flujos de cita, mensajes de seguridad) | Código del asistente: envíe sus correcciones y se aplican |

El asistente trata al paciente de **usted**.

**Frases que conviene validar con especial cuidado:** el aviso de consentimiento (A/C/D), los mensajes de emergencia y salud mental (I1, I2), la respuesta de «no puedo dar diagnósticos» (I3) y la información de laboratorio y resultados (G3, H1).
`;
writeFileSync(new URL('../docs/TEXTOS_PROSALUD.md', import.meta.url), `${header}${out.join('\n')}\n`);
console.log(`docs/TEXTOS_PROSALUD.md generado: ${n} mensajes.`);
