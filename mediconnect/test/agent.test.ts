import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, all, one, run } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { handleIncoming } from '../src/agent/engine.ts';
import { assessSafety } from '../src/agent/safety.ts';
import { runRemindersForClinic } from '../src/services/reminders.ts';
import { getClinic } from '../src/services/clinic.ts';
import { addMinutes, nowLocal } from '../src/util.ts';

const fresh = () => { const db = openDb(':memory:'); seedDemo(db); return db; };
const talk = (db: any, clinic: number, phone: string, lines: string[]) => lines.map((l) => handleIncoming(db, clinic, phone, l).replies.join('\n'));
const last = (a: string[]) => a[a.length - 1];

test('el nombre se registra bien capitalizado, con tildes y partículas', () => {
  const db = fresh();
  const p = '+593990009001';
  talk(db, 1, p, ['Hola', '4', 'si', '1', 'JOSÉ pérez de la cruz']);
  const conf = talk(db, 1, p, ['medicina general', '1', '1'])[2];
  assert.match(conf, /👤 José Pérez de la Cruz/);
});

test('consentimiento: conserva el servicio pedido en el primer mensaje y no repite el aviso largo', () => {
  const db = fresh();
  const p = '+593990009002';
  talk(db, 1, p, ['quiero una cita con el dentista']);                 // servicio de área: no pide consentimiento
  const first = talk(db, 1, p, ['menu', 'quiero una cita con medicina general', 'quizás']);
  assert.doesNotMatch(first[2], /Protecci[oó]n de Datos Personales/);   // el reintento es corto
  assert.match(first[2], /¿acepta/i);
  const after = talk(db, 1, p, ['si', '1', 'Ana Gil Mora']);
  assert.match(after[2], /Medicina General|profesional|horarios/);       // saltó directo a médico u horarios: recordó «medicina general»
  assert.doesNotMatch(after[2], /¿Con qué especialidad/);
});

test('guardarraíles: emergencias, autolesión y diagnóstico', () => {
  assert.equal(assessSafety('Tengo dolor fuerte en el pecho'), 'emergency');
  assert.equal(assessSafety('mi hijo no puede respirar'), 'emergency');
  assert.equal(assessSafety('mi mamá se desmayó'), 'emergency');
  assert.equal(assessSafety('no puedo respirar bien'), 'emergency');
  assert.equal(assessSafety('me quiero morir'), 'self_harm');
  assert.equal(assessSafety('¿qué tengo si me duele la cabeza?'), 'diagnosis');
  assert.equal(assessSafety('Quiero una cita con pediatría'), null);
});

test('emergencia: orienta al 911, marca la conversación y alerta al personal', () => {
  const db = fresh();
  const [r] = talk(db, 1, '+593990001111', ['Tengo dolor fuerte en el pecho y me desmayo']);
  assert.match(r, /911/);
  assert.equal(one<any>(db, `SELECT flag FROM conversations WHERE clinic_id=1 AND patient_phone='+593990001111'`).flag, 'emergency');
  assert.ok(one(db, `SELECT id FROM notifications WHERE clinic_id=1 AND type='emergency' AND level='urgent'`));
  assert.doesNotMatch(r, /diagn[oó]stic[ao] es/i);
});

test('no diagnostica ni recomienda medicamentos y ofrece agendar', () => {
  const db = fresh();
  const [r] = talk(db, 1, '+593990001112', ['Me duele la cabeza, ¿qué medicamento puedo tomar?']);
  assert.match(r, /no puedo dar diagn[oó]sticos/i);
  assert.match(r, /agendar/i);
});

test('agendar exige consentimiento y solo pide el nombre (sin datos clínicos)', () => {
  const db = fresh();
  const out = talk(db, 1, '+593990001113', ['Quiero agendar una cita', 'no']);
  assert.match(out[0], /Protecci[oó]n de Datos Personales/);
  assert.match(out[1], /Sin su autorizaci[oó]n/);
  assert.equal(one(db, `SELECT id FROM patients WHERE clinic_id=1 AND phone='+593990001113'`), undefined);
  const out2 = talk(db, 1, '+593990001114', ['agendar', 'si', '1']);
  assert.match(last(out2), /nombre y apellido/i);
  assert.doesNotMatch(out2.join(' '), /s[ií]ntoma|motivo de consulta|c[eé]dula/i);
});

test('flujo completo: agendar, reagendar y cancelar por WhatsApp', () => {
  const db = fresh();
  const p = '+593990001115';
  const out = talk(db, 1, p, ['Hola', '4', 'si', '1', 'Lucia Mendez Rivas', '1', '1', '1', 'si']);
  assert.match(last(out), /Cita confirmada/);
  const a1 = one<any>(db, `SELECT a.* FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.phone=?`, p);
  assert.equal(a1.status, 'scheduled'); assert.equal(a1.source, 'whatsapp');
  assert.equal(one<any>(db, `SELECT name FROM patients WHERE phone=?`, p).name, 'Lucia Mendez Rivas');

  const re = talk(db, 1, p, ['quiero reagendar', '2', 'si']);
  assert.match(last(re), /Cita reagendada/);
  const a2 = one<any>(db, `SELECT * FROM appointments WHERE id=?`, a1.id);
  assert.notEqual(a2.start_at, a1.start_at); assert.equal(a2.doctor_id, a1.doctor_id);

  const ca = talk(db, 1, p, ['cancelar mi cita', 'si']);
  assert.match(last(ca), /cancelada/);
  assert.equal(one<any>(db, `SELECT status FROM appointments WHERE id=?`, a1.id).status, 'cancelled');
});

test('no permite doble reserva del mismo horario', () => {
  const db = fresh();
  talk(db, 1, '+593990002001', ['agendar', 'si', '1', 'Ana Perez Soto', '1', '1', '1']);
  talk(db, 1, '+593990002002', ['agendar', 'si', '1', 'Luis Gil Mora', '1', '1', '1']);
  // ambos eligieron la opción 1: el segundo debe recibir otro horario o un aviso, nunca duplicar
  assert.match(last(talk(db, 1, '+593990002001', ['si'])), /Cita confirmada/);
  assert.match(last(talk(db, 1, '+593990002002', ['si'])), /ya no est[aá] disponible/i);
  const dup = all(db, `SELECT doctor_id, start_at, COUNT(*) n FROM appointments WHERE status='scheduled' GROUP BY doctor_id, start_at HAVING n > 1`);
  assert.equal(dup.length, 0);
});

test('derivación a humano: el bot calla y el personal puede devolver el control', () => {
  const db = fresh();
  const p = '+593990003001';
  const [r1] = talk(db, 1, p, ['quiero hablar con una persona']);
  assert.match(r1, /recepci[oó]n|guardia/i);
  assert.equal(handleIncoming(db, 1, p, 'hola?').replies.length, 0);
  run(db, `UPDATE conversations SET status='bot' WHERE clinic_id=1 AND patient_phone=?`, p);
  assert.ok(handleIncoming(db, 1, p, 'hola').replies.length > 0);
});

test('fuera de horario: se notifica al personal de guardia', () => {
  const db = fresh();
  const sunday = '2026-10-04T22:00';
  handleIncoming(db, 1, '+593990003002', 'recepcionista por favor', { now: sunday });
  const n = one<any>(db, `SELECT * FROM notifications WHERE clinic_id=1 AND type='oncall' ORDER BY id DESC`);
  assert.ok(n); assert.equal(n.target, '+593990009999');
  const msgs = all<any>(db, `SELECT body FROM messages WHERE direction='out' ORDER BY id DESC LIMIT 1`);
  assert.match(msgs[0].body, /fuera de nuestro horario/i);
});

test('con WhatsApp de recepción: se entrega el enlace en cualquier horario y no se toma el chat', () => {
  const db = fresh();
  const c = getClinic(db, 1)!;
  run(db, `UPDATE clinics SET settings = ? WHERE id = 1`, JSON.stringify({ ...c.settings, reception_whatsapp: '+593990001234' }));
  const open = handleIncoming(db, 1, '+593990003010', 'quiero hablar con una persona', { now: '2026-10-05T10:00' }).replies.join('\n');
  assert.match(open, /wa\.me\/593990001234\b/);
  const closed = handleIncoming(db, 1, '+593990003011', 'recepcionista por favor', { now: '2026-10-04T22:00' }).replies.join('\n');
  assert.match(closed, /wa\.me\/593990001234/); assert.match(closed, /fuera de nuestro horario/i);
  assert.ok(handleIncoming(db, 1, '+593990003010', 'hola', { now: '2026-10-05T10:01' }).replies.length > 0);  // el bot sigue activo
});

test('precios: se muestran los de consulta, "gratis" y los otros servicios cargados', () => {
  const db = fresh();
  const c = getClinic(db, 1)!;
  run(db, `UPDATE clinics SET settings = ? WHERE id = 1`, JSON.stringify({ ...c.settings, prices_extra: '• Inyección: $5' }));
  run(db, `UPDATE specialties SET price = 0 WHERE clinic_id = 1 AND name = 'Odontología'`);
  const r = handleIncoming(db, 1, '+593990003020', 'cuánto cuesta', { now: '2026-10-05T10:00' }).replies.join('\n');
  assert.match(r, /Odontolog[ií]a: gratis/); assert.match(r, /Otros servicios[\s\S]*Inyección: \$5/);
});

test('información: precios, ubicación y horarios son de la clínica correcta', () => {
  const db = fresh();
  const [price, loc] = talk(db, 2, '+593990004001', ['cuánto cuesta la consulta', 'dónde están ubicados']);
  assert.match(price, /Odontolog[ií]a/); assert.doesNotMatch(price, /Cardiolog[ií]a/);
  assert.match(loc, /Kennedy/); assert.doesNotMatch(loc, /Urdesa/);
});

test('recordatorios: se generan dentro de la ventana y se pueden confirmar', () => {
  const db = fresh();
  const clinic = getClinic(db, 1)!;
  const p = '+593990005001';
  talk(db, 1, p, ['Hola', '4', 'si', '1', 'Maria Torres Vera', '1', '1', '1', 'si']);
  const a = one<any>(db, `SELECT a.id FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.phone=?`, p);
  run(db, `UPDATE appointments SET start_at = ?, end_at = ? WHERE id = ?`, addMinutes(nowLocal(clinic.timezone), 60 * 5), addMinutes(nowLocal(clinic.timezone), 60 * 5 + 20), a.id);
  assert.ok(runRemindersForClinic(db, clinic) >= 1);
  assert.equal(runRemindersForClinic(db, clinic), 0); // no duplica
  const r = one<any>(db, `SELECT body FROM messages WHERE kind='reminder' ORDER BY id DESC`);
  assert.match(r.body, /Recordatorio de cita/);
  assert.match(last(talk(db, 1, p, ['CONFIRMO'])), /confirmada/i);
  assert.equal(one<any>(db, `SELECT confirmed FROM appointments WHERE id=?`, a.id).confirmed, 1);
});

// ───────── Familiares bajo un mismo número de WhatsApp ─────────
// Nota: las especialidades se listan alfabéticamente; la opción 1 es Cardiología (un solo médico, sin paso de médico).
const book = (db: any, p: string, lines: string[]) => talk(db, 1, p, lines);
const first = (db: any, p: string, name: string) => book(db, p, ['Hola', '4', 'si', '1', name, '1', '1', 'si']);

test('familiares: el titular agenda para sí y para un hijo con el mismo número', () => {
  const db = fresh();
  const p = '+593990007001';
  assert.match(last(first(db, p, 'Carla Rivera Soto')), /Cita confirmada/);
  const who = book(db, p, ['agendar'])[0];
  assert.match(who, /Para mí \(Carla Rivera Soto\)/); assert.match(who, /otra persona/i);
  const out = book(db, p, ['2', 'Mateo Rivera Soto', '1', '1']);
  assert.match(out[3], /representante|autorizaci[oó]n/i);               // declaración del titular antes de registrar
  assert.match(last(book(db, p, ['si'])), /Cita confirmada/);
  const people = all<any>(db, `SELECT name, is_holder, consent_at, consent_version FROM patients WHERE phone=? ORDER BY id`, p);
  assert.deepEqual(people.map((x) => x.is_holder), [1, 0]);
  assert.equal(people[1].name, 'Mateo Rivera Soto'); assert.ok(people[1].consent_at);
  assert.equal(people[1].consent_version, 'LOPDP-v1-representante');
  assert.equal(all(db, `SELECT a.id FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.phone=? AND a.status='scheduled'`, p).length, 2);
});

test('familiares: no se duplica una persona ya registrada y las citas se muestran por persona', () => {
  const db = fresh();
  const p = '+593990007002';
  first(db, p, 'Ana Lopez Mora');
  book(db, p, ['agendar', '2', 'Pedro Lopez Mora', '1', '1', 'si']);
  const again = book(db, p, ['agendar', '3', 'pedro lopez mora'])[2];
  assert.match(again, /Ya tengo registrado a \*Pedro Lopez Mora\*/);
  assert.equal(all(db, `SELECT id FROM patients WHERE phone=?`, p).length, 2);
  book(db, p, ['menu']);
  const mine = book(db, p, ['mis citas'])[0];
  assert.match(mine, /Ana Lopez Mora:/); assert.match(mine, /Pedro Lopez Mora:/);
});

test('familiares: cancelar elige la cita de la persona correcta y reagendar conserva al paciente', () => {
  const db = fresh();
  const p = '+593990007003';
  first(db, p, 'Rosa Vera Ruiz');
  book(db, p, ['agendar', '2', 'Luis Vera Ruiz', '1', '1', 'si']);
  const pick = book(db, p, ['cancelar mi cita'])[0];
  assert.match(pick, /Rosa Vera Ruiz:/); assert.match(pick, /Luis Vera Ruiz:/);
  const kid = pick.split('\n').find((l) => l.includes('Luis Vera Ruiz'))!.match(/\*(\d)\./)![1];
  book(db, p, [kid, 'si']);
  const st = Object.fromEntries(all<any>(db, `SELECT p.name, a.status FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.phone=?`, p).map((r) => [r.name, r.status]));
  assert.deepEqual(st, { 'Rosa Vera Ruiz': 'scheduled', 'Luis Vera Ruiz': 'cancelled' });
  // reagendar la de Rosa (única activa) conserva a la misma paciente
  const before = one<any>(db, `SELECT a.id, a.start_at FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.name='Rosa Vera Ruiz'`);
  assert.match(last(book(db, p, ['reagendar', '2', 'si'])), /Cita reagendada/);
  const after = one<any>(db, `SELECT a.start_at, p.name FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.id=?`, before.id);
  assert.equal(after.name, 'Rosa Vera Ruiz'); assert.notEqual(after.start_at, before.start_at);
});

test('familiares: máximo de personas a cargo por número', () => {
  const db = fresh();
  const p = '+593990007004';
  first(db, p, 'Titular Prueba Uno');
  const kids = ['Alba', 'Beto', 'Carlos', 'Diana', 'Elisa', 'Fabio'];
  kids.forEach((k, i) => book(db, p, ['agendar', String(i + 2), `${k} Prueba Hijo`, '1', '1', 'si']));
  assert.equal(all(db, `SELECT id FROM patients WHERE phone=? AND is_holder=0`, p).length, 6);
  assert.match(book(db, p, ['agendar', '8'])[1], /hasta 6 familiares/);
});

test('familiares: el recordatorio nombra a la persona que tiene la cita', () => {
  const db = fresh();
  const clinic = getClinic(db, 1)!;
  const p = '+593990007005';
  first(db, p, 'Elena Cruz Paz');
  book(db, p, ['agendar', '2', 'Tomas Cruz Paz', '1', '1', 'si']);
  const t = nowLocal(clinic.timezone);
  run(db, `UPDATE appointments SET start_at = ?, end_at = ? WHERE patient_id = (SELECT id FROM patients WHERE name='Tomas Cruz Paz')`, addMinutes(t, 300), addMinutes(t, 320));
  assert.ok(runRemindersForClinic(db, clinic) >= 1);   // (la demo trae otras citas próximas que también pueden recibir recordatorio)
  assert.match(one<any>(db, `SELECT m.body FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.kind='reminder' AND c.patient_phone = ?`, p).body, /cita de \*Tomas Cruz Paz\*/);
  assert.match(last(book(db, p, ['CONFIRMO'])), /Tomas Cruz Paz:/);
  assert.equal(one<any>(db, `SELECT confirmed FROM appointments WHERE patient_id=(SELECT id FROM patients WHERE name='Tomas Cruz Paz')`).confirmed, 1);
});

// ───────── Servicios con tratamiento especial: Odontología (área), Laboratorio / Rayos X (sin cita) ─────────
test('Odontología: se deriva al WhatsApp del área sin pedir consentimiento ni guardar datos', () => {
  const db = fresh();
  const p = '+593990008001';
  const [r1] = talk(db, 1, p, ['Quiero una cita con el dentista']);
  assert.match(r1, /comunicarle directamente con el área correspondiente/);
  assert.match(r1, /Continuar con 🦷 Odontolog[ií]a/);
  assert.equal(one(db, `SELECT id FROM patients WHERE phone=?`, p), undefined);   // no se guardó ningún dato
  const [r2] = talk(db, 1, p, ['1']);
  assert.match(r2, /https:\/\/wa\.me\/593990000444/);                      // enlace al WhatsApp del área
  assert.match(decodeURIComponent(r2), /o al número \*0990 000 444\*/);
  assert.equal(one<any>(db, `SELECT status FROM conversations WHERE patient_phone=?`, p).status, 'bot');
  assert.ok(one(db, `SELECT id FROM notifications WHERE type='referral' AND title LIKE '%Odontolog%'`));
  assert.equal(one(db, `SELECT id FROM patients WHERE phone=?`, p), undefined);
  assert.match(talk(db, 1, p, ['menu'])[0], /Agendar una cita/);                   // el agente sigue disponible
});

test('servicio de área sin WhatsApp propio: pasa a una persona en el panel y el bot calla', () => {
  const db = fresh();
  const p = '+593990008010';
  run(db, `UPDATE specialties SET contact_whatsapp = NULL WHERE name = 'Odontología' AND clinic_id = 1`);
  talk(db, 1, p, ['dentista']);
  const [r] = talk(db, 1, p, ['1']);
  assert.match(r, /área de \*Odontolog[ií]a\*/);                                   // dentro o fuera de horario
  const c = one<any>(db, `SELECT status, handoff_area FROM conversations WHERE patient_phone=?`, p);
  assert.equal(c.status, 'human'); assert.equal(c.handoff_area, 'Odontología');
  assert.equal(handleIncoming(db, 1, p, 'hola?').replies.length, 0);
});

test('Odontología elegida desde la lista de agendar también se deriva; «2» vuelve al menú', () => {
  const db = fresh();
  const p = '+593990008002';
  const out = talk(db, 1, p, ['agendar', 'si', '1', 'Mario Paz Leon']);
  assert.match(out[3], /🦷 Odontolog[ií]a/); assert.match(out[3], /🧪 Laboratorio/);
  assert.match(talk(db, 1, p, ['odontologia'])[0], /área correspondiente/);
  assert.match(talk(db, 1, p, ['2'])[0], /Agendar una cita/);
  assert.equal(one<any>(db, `SELECT status FROM conversations WHERE patient_phone=?`, p).status, 'bot');
});

test('Laboratorio (sin cita): informa, nunca agenda y ofrece pasar al área', () => {
  const db = fresh();
  const p = '+593990008003';
  const [r] = talk(db, 1, p, ['¿Necesito cita para el laboratorio?']);
  assert.match(r, /sin cita/i); assert.match(r, /Hablar con recepción/);
  assert.equal(all(db, `SELECT a.id FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.phone=?`, p).length, 0);
  talk(db, 1, p, ['1']);
  const lab = one<any>(db, `SELECT status, handoff_reason FROM conversations WHERE patient_phone=?`, p);
  assert.equal(lab.status, 'human'); assert.match(lab.handoff_reason, /Laboratorio Clínico/);   // sin WhatsApp propio: pasa a recepción
});

test('resultados: nunca se envían por WhatsApp; interpretarlos sigue siendo no-diagnóstico', () => {
  const db = fresh();
  const [r] = talk(db, 1, '+593990008004', ['¿Me pueden mandar mis resultados por whatsapp?']);
  assert.match(r, /no enviamos resultados por WhatsApp/);
  const [d] = talk(db, 1, '+593990008005', ['¿Me interpretas mis resultados? ¿es normal?']);
  assert.match(d, /no puedo dar diagn[oó]sticos/i);
});

test('palabras genéricas como «clínica» no activan servicios por error', () => {
  const db = fresh();
  const [r] = talk(db, 1, '+593990008006', ['cuánto cuesta una consulta en la clínica']);
  assert.doesNotMatch(r, /sin cita|Hablar con una persona del área|comunicarte directamente/);
  assert.match(r, /Valor de la consulta/);
});

test('sin horario cargado: no se afirma «fuera de horario» y se pide confirmar', () => {
  const db = fresh();
  run(db, `UPDATE clinics SET settings = json_set(settings, '$.hours', json('{"0":[],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}')) WHERE id = 1`);
  const h = talk(db, 1, '+593990008007', ['¿cuál es el horario?'])[0];
  assert.match(h, /Aún no tengo cargado el horario/);
  const [r] = talk(db, 1, '+593990008008', ['quiero hablar con una persona']);
  assert.doesNotMatch(r, /fuera de nuestro horario/); assert.match(r, /recepci[oó]n/i);
});

test('nombre del asistente y opción 2 (horarios, precios y ubicación)', () => {
  const db = fresh();
  run(db, `UPDATE clinics SET settings = json_set(settings, '$.assistant_name', 'SALUD') WHERE id = 1`);
  const p = '+593990008009';
  assert.match(talk(db, 1, p, ['Hola'])[0], /Soy \*SALUD\*, el asistente virtual de \*Clínica Santa Lucía\*/);
  const r = handleIncoming(db, 1, p, '2').replies;
  assert.ok(r.length >= 3); assert.match(r.join('\n'), /Valor de la consulta/); assert.match(r.join('\n'), /Urdesa/);
});

// ───────── Trato de «usted» y lista de servicios separada ─────────
test('el asistente trata siempre de usted (ningún mensaje usa «tú»)', () => {
  const db = fresh();
  run(db, `UPDATE clinics SET settings = json_set(settings, '$.assistant_name', 'SALUD') WHERE id = 1`);
  const tuteo = /\b(tu|tus|te|ti|puedes|quieres|deseas|aceptas|confirmas|necesitas|prefieres|escribe|escríbeme|escríbele|llama|llegas?|acude|elige|dime|ayudarte|entenderte)\b|\bresponde (con|\*)/i;
  const say = (p: string, ls: string[]) => ls.flatMap((l) => handleIncoming(db, 1, p, l).replies);
  const all_ = [
    ...say('+593990010001', ['Hola', 'asdf', 'zzzz', 'xxxx', '5', '6', 'médicos', 'gracias', 'ver disponibilidad', '1']),
    ...say('+593990010002', ['Hola', '4', 'quizás', 'no', 'agendar', 'si', '1', '12345', 'Rosa Gil Mora', '1', 'más', '1', 'no', '1', 'si', 'mis citas', 'reagendar', '2', 'si', 'cancelar mi cita', 'no', 'cancelar', 'si']),
    ...say('+593990010003', ['agendar', 'si', '2', 'Tomas Gil Mora', '1', '1', 'si', 'cancelar mi cita']),
    ...say('+593990010004', ['quiero una cita con el dentista', 'quizás', '1', 'laboratorio', '2', '¿mis resultados?']),
    ...say('+593990010005', ['dolor fuerte en el pecho', 'ya no quiero vivir', '¿qué tengo si me duele la cabeza?', 'quiero agendar, tengo fiebre']),
    ...say('+593990010006', ['quiero hablar con una persona']),
  ];
  assert.ok(all_.length > 40);
  for (const m of all_) assert.doesNotMatch(m, tuteo, `Mensaje con tuteo: ${m.slice(0, 120)}`);
  assert.match(all_.join('\n'), /¿En qué puedo ayudarle\?/);
});

test('lista de agendar: «Citas médicas» y «Otros servicios» en bloques separados con numeración continua', () => {
  const db = fresh();
  const list = talk(db, 1, '+593990010007', ['agendar', 'si', '1', 'Mario Paz León'])[3];
  assert.match(list, /\*Citas médicas\*/); assert.match(list, /\*Otros servicios\*/);
  assert.ok(list.indexOf('Citas médicas') < list.indexOf('Medicina General') && list.indexOf('Medicina General') < list.indexOf('Otros servicios'));
  assert.ok(list.indexOf('Otros servicios') < list.indexOf('Odontolog') && list.indexOf('Otros servicios') < list.indexOf('Laboratorio'));
  const num = (name: string) => Number(list.split('\n').find((l) => l.includes(name))!.match(/\*(\d+)\./)![1]);
  assert.ok(num('Pediatr') < num('Laboratorio'));                          // las citas médicas van primero
  assert.equal(num('Odontolog') - num('Laboratorio'), 1);                  // numeración continua
  // elegir un servicio de área por su número lleva al mensaje del área
  assert.match(talk(db, 1, '+593990010007', [String(num('Odontolog'))])[0], /comunicarle directamente con el área/);
  // el listado informativo (opción 1) también va separado
  const info = talk(db, 1, '+593990010008', ['hola', '1'])[1];
  assert.match(info, /\*Citas médicas\*[\s\S]*\*Otros servicios\*/);
});

test('menú principal en el orden pedido por el revisor y cada número lleva a su opción', () => {
  const db = fresh();
  const menu = talk(db, 1, '+593990011000', ['Hola'])[0];
  const order = ['Especialidades y servicios', 'Horarios, precios y ubicación', 'Ver disponibilidad', 'Agendar una cita', 'Reagendar una cita', 'Cancelar una cita', 'Hablar con recepción'];
  order.forEach((t, i) => assert.match(menu, new RegExp(`\\*${i + 1}\\.\\* ${t}`)));
  const go = (n: string, i: number) => { const p = `+59399001101${i}`; handleIncoming(db, 1, p, 'Hola'); return handleIncoming(db, 1, p, n).replies.join('\n'); };
  assert.match(go('1', 1), /Especialidades y servicios de/);
  assert.match(go('2', 2), /Horario de atención[\s\S]*Valor de la consulta[\s\S]*Urdesa/);   // horarios + precios + ubicación
  assert.match(go('3', 3), /disponibilidad/i);
  assert.match(go('4', 4), /Acepta|¿Para quién es la cita|Protecci[oó]n de Datos/);          // agendar → consentimiento
  assert.match(go('5', 5), /No encuentro citas próximas/);                                    // reagendar sin citas
  assert.match(go('6', 6), /No encuentro citas próximas/);                                    // cancelar sin citas
  assert.match(go('7', 7), /recepci[oó]n|guardia/i);
});

test('mensaje no entendido: las opciones se muestran una sola vez y al segundo intento se ofrece recepción', () => {
  const db = fresh();
  const p = '+593990012000';
  const one_ = handleIncoming(db, 1, p, 'asdf qwer').replies.join('\n');
  assert.match(one_, /No estoy seguro de haber entendido/); assert.match(one_, /Agendar una cita/);
  const two = handleIncoming(db, 1, p, 'zzzz').replies.join('\n');
  assert.match(two, /no logro entenderle/); assert.match(two, /recepci[oó]n/);
  assert.doesNotMatch(two, /No estoy seguro de haber entendido|Agendar una cita/);      // ya no repite el menú
  // el contador se reinicia: un tercer mensaje vuelve a mostrar las opciones una vez
  assert.match(handleIncoming(db, 1, p, 'xxxx').replies.join('\n'), /No estoy seguro de haber entendido/);
  // un mensaje entendido entre medias también reinicia el contador
  handleIncoming(db, 1, p, 'gracias');
  assert.match(handleIncoming(db, 1, p, 'qqqq').replies.join('\n'), /No estoy seguro de haber entendido/);
});
