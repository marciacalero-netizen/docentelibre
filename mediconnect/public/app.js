'use strict';
// Panel administrativo de MediConnect AI (JavaScript puro, sin dependencias ni build).
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = (s) => esc(s).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/(https:\/\/wa\.me\/\d+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, '<br>');
const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const STATUS = { scheduled: ['Programada', 'info'], completed: ['Atendida', 'ok'], cancelled: ['Cancelada', 'bad'], no_show: ['No asistió', 'warn'] };

let me = null, timers = [];
const every = (fn, ms) => timers.push(setInterval(fn, ms));
const stopTimers = () => { timers.forEach(clearInterval); timers = []; };

async function api(method, path, body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') { me = null; renderLogin(); throw new Error('Sesión expirada'); }
  if (!res.ok) throw new Error(data.error || 'Error inesperado');
  return data;
}
const tz = () => me?.clinic.timezone || 'America/Guayaquil';
const dparse = (d) => new Date(d.length === 10 ? d + 'T00:00:00Z' : d + ':00Z');
const fmtDay = (d) => dparse(d).toLocaleDateString('es-EC', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const fmtDT = (l) => `${fmtDay(l)} · ${l.slice(11, 16)}`;
const fmtTs = (iso) => new Date(iso).toLocaleString('es-EC', { timeZone: tz(), dateStyle: 'short', timeStyle: 'short' });
const money = (n) => (n == null ? '—' : '$' + Number(n).toFixed(2));
const addDays = (d, n) => new Date(dparse(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const mondayOf = (d) => addDays(d, -((dparse(d).getUTCDay() + 6) % 7));
const isAdmin = () => me.user.role === 'admin';
const toast = (msg, bad) => { const t = document.createElement('div'); t.className = 'alert ' + (bad ? 'urgent' : ''); t.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:99;max-width:340px'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 3500); };
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

function modal(html, { closable = true } = {}) {
  const b = document.createElement('div'); b.className = 'backdrop';
  b.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { b.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => closable && e.key === 'Escape' && close();
  if (closable) b.addEventListener('mousedown', (e) => e.target === b && close());
  document.addEventListener('keydown', onKey);
  document.body.append(b);
  b.close = close;
  return b;
}

// ───────────────────────── login ─────────────────────────
async function renderLogin() {
  stopTimers();
  const pub = await fetch('/api/public').then((r) => r.json()).catch(() => ({ demo: false }));
  $('#app').innerHTML = `<div class="login"><form class="box" id="lf">
    <div class="logo"><i>＋</i> MediConnect AI</div>
    <p class="muted">Ingresa al panel de tu clínica.</p>
    <label for="em">Correo</label><input id="em" type="email" autocomplete="username" required>
    <label for="pw">Contraseña</label><input id="pw" type="password" autocomplete="current-password" required>
    <div class="err" id="er" role="alert"></div>
    <button class="primary" style="width:100%;margin-top:.5rem">Ingresar</button>
    ${pub.demo ? `<div class="demo-box"><b>Cuentas de demostración</b> (contraseña <code>Demo1234!</code>)<br>
      <button type="button" data-e="admin@santalucia.demo">Admin · Santa Lucía</button>
      <button type="button" data-e="recepcion@santalucia.demo">Recepción · Santa Lucía</button>
      <button type="button" data-e="admin@medisur.demo">Admin · MediSur</button></div>` : ''}
  </form></div>`;
  document.querySelectorAll('.demo-box button').forEach((b) => b.onclick = () => { $('#em').value = b.dataset.e; $('#pw').value = 'Demo1234!'; });
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/login', { email: $('#em').value, password: $('#pw').value }); await boot(); }
    catch (err) { $('#er').textContent = err.message; }
  };
}

// ───────────────────────── layout ─────────────────────────
const NAV = [
  ['resumen', '🏠', 'Resumen'], ['calendario', '📅', 'Calendario'], ['conversaciones', '💬', 'Conversaciones'], ['pacientes', '🧑', 'Pacientes'],
  ['medicos', '🩺', 'Médicos'], ['especialidades', '🏷️', 'Especialidades'], ['alertas', '🔔', 'Alertas'],
  ['estadisticas', '📊', 'Estadísticas', true], ['configuracion', '⚙️', 'Configuración', true], ['simulador', '📱', 'Simulador WhatsApp'],
];

function renderShell() {
  $('#app').innerHTML = `<div class="top"><button id="menu" aria-label="Abrir menú">☰</button><b>MediConnect AI</b><span></span></div>
  <div class="shell"><nav class="side" id="side" aria-label="Principal">
    <div class="logo"><i>＋</i> MediConnect AI</div>
    <div class="clinic">${esc(me.clinic.name)}</div>
    ${NAV.filter((n) => !n[3] || isAdmin()).map((n) => `<a href="#/${n[0]}" data-v="${n[0]}"><span>${n[1]}</span>${n[2]}<span class="badge warn" id="nb-${n[0]}" hidden></span></a>`).join('')}
    <div class="user"><b>${esc(me.user.name)}</b><br><span class="small">${isAdmin() ? 'Administrador' : 'Recepcionista'}</span><button id="pw">Cambiar mi contraseña</button><button id="lo">Cerrar sesión</button></div>
  </nav><main class="main" id="main"></main></div>`;
  $('#menu').onclick = () => $('#side').classList.toggle('open');
  $('#side').onclick = (e) => e.target.closest('a') && $('#side').classList.remove('open');
  $('#pw').onclick = () => passwordModal(false);
  $('#lo').onclick = async () => { await api('POST', '/api/logout'); me = null; renderLogin(); };
}

async function route() {
  stopTimers();
  const v = (location.hash.replace('#/', '') || 'resumen');
  const nav = NAV.find((n) => n[0] === v && (!n[3] || isAdmin())) ? v : 'resumen';
  document.querySelectorAll('.side a').forEach((a) => a.classList.toggle('on', a.dataset.v === nav));
  $('#main').innerHTML = '<p class="muted">Cargando…</p>';
  try { await VIEWS[nav]($('#main')); } catch (e) { if (me) $('#main').innerHTML = `<div class="alert urgent">${esc(e.message)}</div>`; }
  refreshBadges();
  every(refreshBadges, 15000);
}
async function refreshBadges() {
  try {
    const s = await api('GET', '/api/summary');
    const set = (id, n) => { const el = $('#nb-' + id); if (el) { el.hidden = !n; el.textContent = n; } };
    set('conversaciones', s.waiting_human.length); set('alertas', s.urgent_unread);
  } catch { /* se ignora */ }
}

// ───────────────────────── resumen ─────────────────────────
const apptRow = (a) => `<tr><td>${a.start_at.slice(11, 16)}</td><td>${esc(a.patient_name || a.patient_phone)}</td><td>${esc(a.doctor_name)}<br><span class="muted small">${esc(a.specialty_name)}</span></td><td><span class="badge ${STATUS[a.status][1]}">${STATUS[a.status][0]}</span>${a.confirmed && a.status === 'scheduled' ? ' <span class="badge ok">Confirmada</span>' : ''}</td></tr>`;

async function viewResumen(el) {
  const s = await api('GET', '/api/summary');
  el.innerHTML = `<div class="page-head"><div><h1>Hola, ${esc(me.user.name.split(' ')[0])} 👋</h1><div class="muted">${esc(fmtDay(s.today))} · ${esc(me.clinic.name)}</div></div></div>
  ${s.urgent_unread ? `<div class="alert urgent"><b>${s.urgent_unread} alerta(s) urgente(s) sin leer.</b> <a href="#/alertas">Ver alertas</a></div>` : ''}
  <div class="kpis">
    <div class="kpi"><b>${s.appointments_today.filter((a) => a.status !== 'cancelled').length}</b><span>Citas de hoy</span></div>
    <div class="kpi"><b>${s.upcoming_count}</b><span>Citas próximas</span></div>
    <div class="kpi"><b>${s.pending_confirmation}</b><span>Por confirmar (3 días)</span></div>
    <div class="kpi"><b>${s.waiting_human.length}</b><span>Esperan recepcionista</span></div></div>
  <div class="grid2"><div class="card"><h2>Citas de hoy</h2><div class="tablewrap"><table><thead><tr><th>Hora</th><th>Paciente</th><th>Médico</th><th>Estado</th></tr></thead><tbody>
    ${s.appointments_today.map(apptRow).join('') || '<tr><td colspan="4" class="muted">Sin citas hoy.</td></tr>'}</tbody></table></div></div>
  <div class="card"><h2>Conversaciones esperando a recepción</h2>
    ${s.waiting_human.map((c) => `<div class="convitem"><a href="#/conversaciones" data-c="${c.id}"><b>${esc(c.patient_name || c.patient_phone)}</b></a>${c.handoff_area ? ` <span class="badge info">${esc(c.handoff_area)}</span>` : ''}<div class="small muted">${esc(c.handoff_reason || '')} · ${fmtTs(c.last_message_at)}</div></div>`).join('') || '<p class="muted">Nada pendiente. ✅</p>'}
  </div></div>`;
  el.querySelectorAll('[data-c]').forEach((a) => a.onclick = () => sessionStorage.setItem('openConv', a.dataset.c));
}

// ───────────────────────── calendario ─────────────────────────
let calWeek = null, calDoctor = '';
async function viewCalendario(el) {
  calWeek = calWeek || mondayOf(me.today);
  const doctors = await api('GET', '/api/doctors');
  const to = addDays(calWeek, 6);
  const q = `from=${calWeek}&to=${to}${calDoctor ? '&doctor_id=' + calDoctor : ''}`;
  const appts = await api('GET', '/api/appointments?' + q);
  el.innerHTML = `<div class="page-head"><div><h1>Calendario</h1><div class="muted">Semana del ${esc(fmtDay(calWeek))} al ${esc(fmtDay(to))}</div></div>
    <div class="row"><button id="prev" aria-label="Semana anterior">◀</button><button id="tod">Hoy</button><button id="next" aria-label="Semana siguiente">▶</button>
    <select id="fd" aria-label="Filtrar por médico" style="width:auto"><option value="">Todos los médicos</option>${doctors.filter((d) => d.active).map((d) => `<option value="${d.id}" ${String(d.id) === String(calDoctor) ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
    <button class="primary" id="new">＋ Nueva cita</button></div></div>
    <div class="week">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(calWeek, i);
      return `<div class="day ${d === me.today ? 'today' : ''}"><h4>${esc(fmtDay(d))}</h4>${appts.filter((a) => a.start_at.startsWith(d)).map((a) =>
        `<button class="appt ${a.status}" data-id="${a.id}"><b>${a.start_at.slice(11, 16)} ${a.confirmed && a.status === 'scheduled' ? '✔' : ''}</b>${esc(a.patient_name || a.patient_phone)}<br><span class="muted">${esc(a.doctor_name)}</span></button>`).join('') || '<span class="muted small">—</span>'}</div>`;
    }).join('')}</div>`;
  $('#prev').onclick = () => { calWeek = addDays(calWeek, -7); route(); };
  $('#next').onclick = () => { calWeek = addDays(calWeek, 7); route(); };
  $('#tod').onclick = () => { calWeek = mondayOf(me.today); route(); };
  $('#fd').onchange = (e) => { calDoctor = e.target.value; route(); };
  $('#new').onclick = () => newApptModal(doctors.filter((d) => d.active));
  el.querySelectorAll('.appt').forEach((b) => b.onclick = () => apptModal(appts.find((a) => a.id == b.dataset.id), doctors));
}

function apptModal(a, doctors) {
  const m = modal(`<h2>Cita #${a.id}</h2>
    <p><b>${esc(a.patient_name || a.patient_phone)}</b><br><span class="muted">${esc(a.patient_phone)}</span></p>
    <p>${esc(a.doctor_name)} — ${esc(a.specialty_name)}<br>📅 ${esc(fmtDT(a.start_at))} · ${money(a.price)} · origen: ${esc(a.source)}</p>
    <p><span class="badge ${STATUS[a.status][1]}">${STATUS[a.status][0]}</span> ${a.confirmed ? '<span class="badge ok">Asistencia confirmada</span>' : ''}</p>
    ${a.status === 'scheduled' ? `<div class="card"><h3>Reagendar</h3><div class="row"><input type="date" id="rd" value="${a.start_at.slice(0, 10)}" style="width:auto"><select id="rt" style="width:auto"></select><button id="rg">Mover</button></div></div>` : ''}
    <div class="actions">${a.status === 'scheduled' ? `<button id="cf">Marcar confirmada</button><button id="ok">Atendida</button><button id="ns">No asistió</button><button class="danger" id="cx">Cancelar cita</button>` : ''}<button id="cl">Cerrar</button></div>`);
  const act = (action, extra) => guard(async () => { await api('PATCH', `/api/appointments/${a.id}`, { action, ...extra }); m.close(); route(); })();
  $('#cl', m).onclick = m.close;
  if (a.status !== 'scheduled') return;
  $('#cf', m).onclick = () => act('confirm'); $('#ok', m).onclick = () => act('complete'); $('#ns', m).onclick = () => act('no_show');
  $('#cx', m).onclick = () => confirm('¿Cancelar esta cita?') && act('cancel');
  const loadSlots = guard(async () => { const s = await api('GET', `/api/slots?doctor_id=${a.doctor_id}&date=${$('#rd', m).value}`); $('#rt', m).innerHTML = s.map((t) => `<option>${t}</option>`).join('') || '<option value="">Sin horarios</option>'; });
  $('#rd', m).onchange = loadSlots; loadSlots();
  $('#rg', m).onclick = () => $('#rt', m).value && act('reschedule', { date: $('#rd', m).value, time: $('#rt', m).value });
}

function newApptModal(doctors) {
  const m = modal(`<h2>Nueva cita</h2>
    <label for="nd">Médico</label><select id="nd">${doctors.map((d) => `<option value="${d.id}">${esc(d.name)} — ${esc(d.specialty_name)}</option>`).join('')}</select>
    <div class="grid2"><div><label for="nf">Fecha</label><input type="date" id="nf" value="${me.today}" min="${me.today}"></div><div><label for="nt">Hora disponible</label><select id="nt"></select></div></div>
    <div class="grid2"><div><label for="np">WhatsApp del paciente</label><input id="np" placeholder="+593 99 000 0000" inputmode="tel"></div><div><label for="nn">Nombre completo</label><input id="nn"></div></div>
    <p class="small muted">Si el número ya tiene un paciente con otro nombre, la persona se registrará como <b>familiar</b> del titular (máx. 6). Si el paciente es nuevo, su consentimiento de datos quedará <b>pendiente</b> hasta que lo acepte por WhatsApp.</p>
    <div class="actions"><button id="x">Cancelar</button><button class="primary" id="s">Crear cita</button></div>`);
  const loadSlots = guard(async () => { const s = await api('GET', `/api/slots?doctor_id=${$('#nd', m).value}&date=${$('#nf', m).value}`); $('#nt', m).innerHTML = s.map((t) => `<option>${t}</option>`).join('') || '<option value="">Sin horarios</option>'; });
  $('#nd', m).onchange = loadSlots; $('#nf', m).onchange = loadSlots; loadSlots();
  $('#x', m).onclick = m.close;
  $('#s', m).onclick = guard(async () => {
    await api('POST', '/api/appointments', { doctor_id: $('#nd', m).value, date: $('#nf', m).value, time: $('#nt', m).value, phone: $('#np', m).value, name: $('#nn', m).value });
    m.close(); toast('Cita creada'); route();
  });
}

// ───────────────────────── pacientes ─────────────────────────
async function viewPacientes(el) {
  el.innerHTML = `<div class="page-head"><div><h1>Pacientes</h1><div class="muted">Solo se guardan nombre y número de WhatsApp. Un mismo número puede tener familiares a cargo.</div></div><input id="q" placeholder="Buscar por nombre o teléfono" style="max-width:320px" aria-label="Buscar paciente"></div><div class="card tablewrap" id="pt"></div>`;
  const load = guard(async () => {
    const rows = await api('GET', '/api/patients?q=' + encodeURIComponent($('#q').value));
    $('#pt').innerHTML = `<table><thead><tr><th>Nombre</th><th>WhatsApp</th><th>Citas</th><th>Última visita</th><th>Consentimiento</th></tr></thead><tbody>${rows.map((p) => `<tr class="click" data-id="${p.id}"><td>${esc(p.name || '(sin nombre)')}${p.holder_name ? `<br><span class="muted small">👪 Familiar de ${esc(p.holder_name)}</span>` : ''}</td><td>${esc(p.phone)}</td><td>${p.appointments}</td><td>${p.last_visit ? esc(fmtDay(p.last_visit.slice(0, 10))) : '—'}</td><td>${p.anonymized ? '<span class="badge">Anonimizado</span>' : p.consent_at ? '<span class="badge ok">Aceptado</span>' : '<span class="badge warn">Pendiente</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sin resultados.</td></tr>'}</tbody></table>`;
    $('#pt').querySelectorAll('tr.click').forEach((r) => r.onclick = () => patientModal(r.dataset.id));
  });
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  load();
}
const patientModal = guard(async (id) => {
  const p = await api('GET', '/api/patients/' + id);
  const m = modal(`<h2>${esc(p.name || '(sin nombre)')}</h2><p class="muted">${esc(p.phone)}</p>
    ${p.family.length ? `<p>👪 ${p.is_holder ? 'Familiares a cargo' : 'Titular y otros familiares'} (mismo WhatsApp): ${p.family.map((f) => `<span class="badge">${esc(f.name || '(sin nombre)')}${f.is_holder ? ' · titular' : ''}</span>`).join(' ')}</p>` : ''}
    <p>Consentimiento de datos (LOPDP): ${p.consent_at ? `<span class="badge ok">Aceptado ${esc(fmtTs(p.consent_at))}</span>` : '<span class="badge warn">Pendiente</span>'}</p>
    <h3>Historial de citas</h3><div class="tablewrap"><table><tbody>${p.appointments.map((a) => `<tr><td>${esc(fmtDT(a.start_at))}</td><td>${esc(a.doctor_name)}</td><td><span class="badge ${STATUS[a.status][1]}">${STATUS[a.status][0]}</span></td></tr>`).join('') || '<tr><td class="muted">Sin citas.</td></tr>'}</tbody></table></div>
    <div class="actions">${isAdmin() && !p.anonymized ? `<button class="danger" id="an">Anonimizar${p.is_holder && p.family.length ? ' al titular y sus familiares' : ''} (derecho de supresión)</button>` : ''}<button id="cl">Cerrar</button></div>`);
  $('#cl', m).onclick = m.close;
  const an = $('#an', m);
  if (an) an.onclick = guard(async () => {
    if (!confirm('Se eliminarán nombre y teléfono' + (p.is_holder ? ' (del titular y de todos sus familiares), el contenido de la conversación' : '') + ', y se cancelarán las citas futuras. Esta acción no se puede deshacer. ¿Continuar?')) return;
    await api('POST', `/api/patients/${id}/anonymize`); m.close(); toast('Paciente anonimizado'); route();
  });
});

// ───────────────────────── médicos y especialidades ─────────────────────────
const schedSummary = (s) => s.map((b) => `${DOW[b.weekday].slice(0, 3)} ${b.start_time}–${b.end_time}`).join(' · ') || 'Sin horario';
async function viewMedicos(el) {
  const [docs, specs] = await Promise.all([api('GET', '/api/doctors'), api('GET', '/api/specialties')]);
  el.innerHTML = `<div class="page-head"><div><h1>Médicos</h1><div class="muted">Disponibilidad que usa el agente para agendar.</div></div>${isAdmin() ? '<button class="primary" id="nw">＋ Nuevo médico</button>' : ''}</div>
  <div class="card tablewrap"><table><thead><tr><th>Médico</th><th>Especialidad</th><th>Consulta</th><th>Horario</th><th>Estado</th></tr></thead><tbody>
  ${docs.map((d) => `<tr class="${isAdmin() ? 'click' : ''}" data-id="${d.id}"><td><b>${esc(d.name)}</b>${d.calendar_id ? ' <span title="Tiene calendario de Google propio">📅</span>' : ''}</td><td>${esc(d.specialty_name)}</td><td>${money(d.price ?? d.specialty_price)} <span class="muted small">/ ${d.slot_minutes} min</span></td><td class="small">${esc(schedSummary(d.schedule))}</td><td>${d.active ? '<span class="badge ok">Activo</span>' : '<span class="badge">Inactivo</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  if (!isAdmin()) return;
  $('#nw').onclick = () => doctorModal(null, specs);
  el.querySelectorAll('tr.click').forEach((r) => r.onclick = () => doctorModal(docs.find((d) => d.id == r.dataset.id), specs));
}
function doctorModal(d, specs) {
  const blocks = d ? d.schedule.map((s) => ({ weekday: s.weekday, start: s.start_time, end: s.end_time })) : [];
  const m = modal(`<h2>${d ? 'Editar médico' : 'Nuevo médico'}</h2>
    <label for="dn">Nombre (con título)</label><input id="dn" value="${esc(d?.name)}" maxlength="80">
    <div class="grid2"><div><label for="ds">Especialidad</label><select id="ds">${specs.map((s) => `<option value="${s.id}" ${d?.specialty_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div><label for="dp">Precio propio (vacío = el de la especialidad)</label><input id="dp" type="number" min="0" step="0.5" value="${d?.price ?? ''}"></div></div>
    <div class="grid2"><div><label for="dm">Duración de cada cita (min)</label><input id="dm" type="number" min="10" max="120" step="5" value="${d?.slot_minutes ?? 30}"></div>
    <div><label>&nbsp;</label><label style="color:var(--ink)"><input type="checkbox" id="da" style="width:auto" ${!d || d.active ? 'checked' : ''}> Activo (visible para el agente)</label></div></div>
    <label for="dc">ID de Google Calendar de este médico (opcional; si está vacío se usa el calendario predeterminado)</label><input id="dc" value="${esc(d?.calendar_id)}" placeholder="correo@gmail.com o …@group.calendar.google.com" maxlength="200">
    ${d ? '<h3 style="margin-top:1rem">Horario semanal</h3><div id="sch"></div><button id="ab">＋ Añadir bloque</button>' : '<p class="small muted">Podrás cargar el horario semanal después de crearlo.</p>'}
    <div class="actions"><button id="x">Cancelar</button><button class="primary" id="s">Guardar</button></div>`);
  const draw = () => { if (!d) return; $('#sch', m).innerHTML = blocks.map((b, i) => `<div class="sched-row"><select data-i="${i}" data-k="weekday">${DOW.map((n, k) => `<option value="${k}" ${k === b.weekday ? 'selected' : ''}>${n}</option>`).join('')}</select><input type="time" data-i="${i}" data-k="start" value="${b.start}"><input type="time" data-i="${i}" data-k="end" value="${b.end}"><button data-rm="${i}" aria-label="Quitar">✕</button></div>`).join('') || '<p class="muted small">Sin bloques.</p>';
    $('#sch', m).querySelectorAll('[data-k]').forEach((x) => x.onchange = () => { blocks[x.dataset.i][x.dataset.k] = x.dataset.k === 'weekday' ? Number(x.value) : x.value; });
    $('#sch', m).querySelectorAll('[data-rm]').forEach((x) => x.onclick = () => { blocks.splice(x.dataset.rm, 1); draw(); }); };
  draw();
  if (d) $('#ab', m).onclick = () => { blocks.push({ weekday: 1, start: '08:00', end: '12:00' }); draw(); };
  $('#x', m).onclick = m.close;
  $('#s', m).onclick = guard(async () => {
    const body = { name: $('#dn', m).value, specialty_id: $('#ds', m).value, price: $('#dp', m).value, slot_minutes: $('#dm', m).value, calendar_id: $('#dc', m).value, active: $('#da', m).checked };
    if (d) { await api('PATCH', '/api/doctors/' + d.id, body); await api('PUT', `/api/doctors/${d.id}/schedule`, { blocks }); }
    else await api('POST', '/api/doctors', body);
    m.close(); toast('Guardado'); route();
  });
}

const KIND = { appointment: 'Con cita (el agente agenda)', handoff: 'Atención directa con el área (se deriva a su WhatsApp si lo tiene)', walkin: 'Sin cita (el agente informa)' };
async function viewEspecialidades(el) {
  const specs = await api('GET', '/api/specialties');
  el.innerHTML = `<div class="page-head"><div><h1>Especialidades y servicios</h1></div>${isAdmin() ? '<button class="primary" id="nw">＋ Nueva especialidad</button>' : ''}</div>
  <div class="card tablewrap"><table><thead><tr><th>Servicio</th><th>Tipo</th><th>Descripción</th><th>Precio</th><th>Estado</th></tr></thead><tbody>${specs.map((s) => `<tr class="${isAdmin() ? 'click' : ''}" data-id="${s.id}"><td><b>${esc((s.emoji ? s.emoji + ' ' : '') + s.name)}</b></td><td>${KIND[s.kind]}${s.contact_whatsapp ? `<br><span class="muted small">WhatsApp del área: ${esc(s.contact_whatsapp)}</span>` : ''}</td><td>${esc(s.description)}</td><td>${s.kind === 'appointment' ? money(s.price) : '—'}</td><td>${s.active ? '<span class="badge ok">Activa</span>' : '<span class="badge">Inactiva</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  if (!isAdmin()) return;
  const edit = (s) => {
    const m = modal(`<h2>${s ? 'Editar' : 'Nueva'} especialidad</h2><label for="sn">Nombre</label><input id="sn" value="${esc(s?.name)}" maxlength="80"><label for="sd">Descripción</label><input id="sd" value="${esc(s?.description)}" maxlength="200">
      <label for="sk">Tipo de servicio</label><select id="sk">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${(s?.kind || 'appointment') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div class="grid2"><div><label for="se">Emoji (opcional)</label><input id="se" value="${esc(s?.emoji)}" maxlength="8"></div><div><label for="sp">Precio de la consulta (USD, vacío = «consultar»)</label><input id="sp" type="number" min="0" step="0.5" value="${s?.price ?? ''}"></div></div>
      <label for="sc">WhatsApp propio del área (opcional; si lo tiene, el agente deriva al paciente a ese número)</label><input id="sc" value="${esc(s?.contact_whatsapp)}" placeholder="+593…" inputmode="tel">
      <label for="sw">Palabras clave para reconocerlo (separadas por coma)</label><input id="sw" value="${esc(s?.keywords)}" placeholder="dentista, muela, diente" maxlength="300">
      <label for="si">Mensaje propio para servicios sin cita o de atención directa (opcional)</label><textarea id="si" rows="4" maxlength="1200">${esc(s?.info)}</textarea>
      <p class="small muted">«Con cita»: el agente agenda con los médicos cargados. «Atención directa»: el agente informa y pasa la conversación a una persona del área. «Sin cita»: el agente informa y ofrece pasar al área; nunca agenda.</p>
      <label style="color:var(--ink)"><input type="checkbox" id="sa" style="width:auto" ${!s || s.active ? 'checked' : ''}> Activa</label>
      <div class="actions"><button id="x">Cancelar</button><button class="primary" id="g">Guardar</button></div>`);
    $('#x', m).onclick = m.close;
    $('#g', m).onclick = guard(async () => {
      const body = { name: $('#sn', m).value, description: $('#sd', m).value, price: $('#sp', m).value, kind: $('#sk', m).value, emoji: $('#se', m).value, keywords: $('#sw', m).value, info: $('#si', m).value, contact_whatsapp: $('#sc', m).value, active: $('#sa', m).checked };
      await (s ? api('PATCH', '/api/specialties/' + s.id, body) : api('POST', '/api/specialties', body)); m.close(); route();
    });
  };
  $('#nw').onclick = () => edit(null);
  el.querySelectorAll('tr.click').forEach((r) => r.onclick = () => edit(specs.find((s) => s.id == r.dataset.id)));
}

// ───────────────────────── conversaciones ─────────────────────────
let curConv = null;
async function viewConversaciones(el) {
  const pre = sessionStorage.getItem('openConv'); sessionStorage.removeItem('openConv');
  if (pre) curConv = Number(pre);
  el.innerHTML = `<div class="page-head"><div><h1>Conversaciones</h1><div class="muted">Registro de lo que el agente conversa con los pacientes. Se actualiza solo.</div></div></div>
    <div class="convs"><div class="card convlist" id="cl" style="padding:0"></div><div class="card" id="cv"><p class="muted">Selecciona una conversación.</p></div></div>`;
  const loadList = guard(async () => {
    const list = await api('GET', '/api/conversations');
    $('#cl').innerHTML = list.map((c) => `<div class="convitem ${c.id === curConv ? 'on' : ''}" data-id="${c.id}"><div class="row"><b>${esc(c.patient_name || c.patient_phone)}</b>${c.flag ? '<span class="badge bad">🚨 Emergencia</span>' : ''}${c.status === 'human' ? `<span class="badge warn">${c.handoff_area ? 'Espera área: ' + esc(c.handoff_area) : 'Espera recepción'}</span>` : ''}</div><div class="last">${esc((c.last_body || '').replace(/\n/g, ' '))}</div><div class="small muted">${esc(fmtTs(c.last_message_at))}</div></div>`).join('');
    $('#cl').querySelectorAll('.convitem').forEach((i) => i.onclick = () => { curConv = Number(i.dataset.id); loadList(); loadConv(true); });
  });
  const loadConv = guard(async (scroll) => {
    if (!curConv) return;
    const c = await api('GET', '/api/conversations/' + curConv);
    const box = $('#cv');
    const typing = box.querySelector('input')?.value;
    box.innerHTML = `<div class="row" style="justify-content:space-between"><div><h3>${esc(c.patient_name || c.patient_phone)}</h3><span class="muted small">${esc(c.patient_phone)}</span> ${c.status === 'human' ? `<span class="badge warn">Atiende el personal${c.handoff_area ? ' · ' + esc(c.handoff_area) : ''}</span>` : '<span class="badge info">Atiende el agente</span>'} ${c.flag ? '<span class="badge bad">🚨 Emergencia detectada</span>' : ''}</div>
      <div class="row">${c.status === 'bot' ? '<button id="tk">Tomar conversación</button>' : '<button id="rl">Devolver al agente</button>'}</div></div>
      ${c.handoff_reason ? `<p class="small muted">Motivo de derivación: ${esc(c.handoff_reason)}</p>` : ''}
      <div class="chat"><div class="msgs" id="ms">${c.messages.map((m) => `<div class="bubble ${m.sender === 'patient' ? '' : m.sender === 'staff' ? 'staff' : 'me'}">${rich(m.body)}<small>${m.sender === 'patient' ? 'Paciente' : m.sender === 'staff' ? 'Recepción' : m.kind === 'reminder' ? 'Agente · recordatorio' : 'Agente'} · ${esc(fmtTs(m.created_at))}</small></div>`).join('')}</div>
      <form id="rf"><input placeholder="Responder como recepción…" maxlength="1000" aria-label="Mensaje"><button class="primary">Enviar</button></form></div>`;
    const ms = $('#ms'); if (scroll || ms.dataset.keep !== '1') ms.scrollTop = ms.scrollHeight;
    if (typing) box.querySelector('input').value = typing;
    const t = $('#tk'), r = $('#rl');
    if (t) t.onclick = guard(async () => { await api('POST', `/api/conversations/${curConv}/takeover`); loadConv(); loadList(); });
    if (r) r.onclick = guard(async () => { await api('POST', `/api/conversations/${curConv}/release`); loadConv(); loadList(); });
    $('#rf').onsubmit = guard(async (e) => { e.preventDefault(); const i = e.target.querySelector('input'); if (!i.value.trim()) return; await api('POST', `/api/conversations/${curConv}/reply`, { text: i.value }); i.value = ''; loadConv(true); loadList(); });
  });
  await loadList(); if (curConv) await loadConv(true);
  every(() => { loadList(); if (!document.activeElement || document.activeElement.tagName !== 'INPUT') loadConv(); }, 5000);
}

// ───────────────────────── alertas ─────────────────────────
async function viewAlertas(el) {
  const list = await api('GET', '/api/notifications');
  el.innerHTML = `<div class="page-head"><div><h1>Alertas</h1><div class="muted">Emergencias detectadas, derivaciones y avisos al personal de guardia.</div></div><button id="ra">Marcar todas como leídas</button></div>
  ${list.map((n) => `<div class="alert ${n.level === 'urgent' ? 'urgent' : ''}" style="${n.read ? 'opacity:.6' : ''}"><div class="row" style="justify-content:space-between"><b>${esc(n.title)}</b><span class="small">${esc(fmtTs(n.created_at))}</span></div><div>${esc(n.body)}</div>${n.target ? `<div class="small">Destino (WhatsApp de guardia): ${esc(n.target)}</div>` : ''}
    <div class="row" style="margin-top:.4rem">${n.conversation_id ? `<a href="#/conversaciones" data-c="${n.conversation_id}">Ver conversación</a>` : ''}${n.read ? '' : `<button data-r="${n.id}" style="padding:.15rem .6rem">Marcar leída</button>`}</div></div>`).join('') || '<p class="muted">Sin alertas.</p>'}`;
  $('#ra').onclick = guard(async () => { await api('POST', '/api/notifications/read-all'); route(); });
  el.querySelectorAll('[data-r]').forEach((b) => b.onclick = guard(async () => { await api('POST', `/api/notifications/${b.dataset.r}/read`); route(); }));
  el.querySelectorAll('[data-c]').forEach((a) => a.onclick = () => sessionStorage.setItem('openConv', a.dataset.c));
}

// ───────────────────────── estadísticas ─────────────────────────
const bars = (rows, label, val) => { const max = Math.max(1, ...rows.map(val)); return `<div class="bars">${rows.map((r) => `<div class="bar"><span>${esc(label(r))}</span><div class="track"><div class="fill" style="width:${(val(r) / max) * 100}%"></div></div><b>${val(r)}</b></div>`).join('') || '<p class="muted">Sin datos.</p>'}</div>`; };
async function viewEstadisticas(el) {
  const s = await api('GET', '/api/stats'), k = s.kpis;
  el.innerHTML = `<div class="page-head"><div><h1>Estadísticas</h1><div class="muted">Últimos 30 días</div></div></div>
  <div class="kpis">
    <div class="kpi"><b>${k.appointments_30d}</b><span>Citas</span></div><div class="kpi"><b>${k.patients}</b><span>Pacientes registrados</span></div>
    <div class="kpi"><b>${k.bot_resolved_rate}%</b><span>Conversaciones resueltas por el agente</span></div><div class="kpi"><b>${k.handoffs_30d}</b><span>Derivadas a recepción</span></div><div class="kpi"><b>${k.referrals_30d}</b><span>Derivadas al WhatsApp de un área</span></div>
    <div class="kpi"><b>${k.cancel_rate}%</b><span>Cancelaciones</span></div><div class="kpi"><b>${k.no_show_rate}%</b><span>Inasistencias</span></div>
    <div class="kpi"><b>${k.emergencies_30d}</b><span>Emergencias detectadas</span></div><div class="kpi"><b>$${Math.round(k.revenue_30d).toLocaleString('es-EC')}</b><span>Consultas atendidas (estimado)</span></div></div>
  <div class="grid2"><div class="card"><h2>Citas por día (14 días)</h2>${bars(s.by_day, (r) => fmtDay(r.day), (r) => r.n)}</div>
  <div class="card"><h2>Citas por especialidad</h2>${bars(s.by_specialty, (r) => r.name, (r) => r.n)}</div>
  <div class="card"><h2>Estado de las citas</h2>${bars(s.by_status, (r) => STATUS[r.status][0], (r) => r.n)}</div>
  <div class="card"><h2>Origen de las citas</h2>${bars(s.by_source, (r) => (r.source === 'whatsapp' ? 'WhatsApp (agente)' : 'Panel'), (r) => r.n)}</div></div>`;
}

// ───────────────────────── configuración ─────────────────────────
async function viewConfiguracion(el) {
  const [users, gc] = await Promise.all([api('GET', '/api/users'), api('GET', '/api/calendar/status')]);
  const c = me.clinic, s = c.settings;
  el.innerHTML = `<div class="page-head"><div><h1>Configuración de la clínica</h1><div class="muted">Cada clínica tiene su propia información; el agente la usa para responder.</div></div></div>
  <form class="card" id="cf"><h2>Datos generales</h2><div class="grid2"><div><label for="cn">Nombre</label><input id="cn" value="${esc(c.name)}" required maxlength="100"></div><div><label for="cc">Ciudad</label><input id="cc" value="${esc(c.city)}"></div>
    <div><label for="ca">Dirección</label><input id="ca" value="${esc(c.address)}"></div><div><label for="cm">Enlace de mapa</label><input id="cm" value="${esc(c.maps_url)}"></div></div>
    <h2 style="margin-top:1.2rem">Horario de atención de recepción</h2>
    ${[1, 2, 3, 4, 5, 6, 0].map((d) => { const r = (s.hours[d] || [])[0] || ['', '']; return `<div class="hours-row"><span>${DOW[d]}</span><input type="time" data-d="${d}" data-p="0" value="${r[0]}" aria-label="Apertura ${DOW[d]}"><input type="time" data-d="${d}" data-p="1" value="${r[1]}" aria-label="Cierre ${DOW[d]}"></div>`; }).join('')}
    <p class="small muted">Deja vacío para «cerrado». Fuera de este horario el agente sigue atendiendo y avisa al personal de guardia si el paciente pide un humano.</p>
    <h2 style="margin-top:1.2rem">Guardia y seguridad</h2><div class="grid2"><div><label for="gn">Personal de guardia (nombre)</label><input id="gn" value="${esc(s.oncall_name)}"></div><div><label for="gw">WhatsApp de guardia (recibe los avisos)</label><input id="gw" value="${esc(s.oncall_whatsapp)}" placeholder="+593…"></div><div><label for="rw">WhatsApp de recepción (el paciente que pide una persona recibe este enlace)</label><input id="rw" value="${esc(s.reception_whatsapp || '')}" placeholder="+593…"></div>
    <div><label for="ge">Número de emergencias</label><input id="ge" value="${esc(s.emergency_number)}" maxlength="10"></div>
    <div><label for="an">Nombre del asistente (p. ej. MediConnect)</label><input id="an" value="${esc(s.assistant_name)}" maxlength="40"></div></div>
    <label for="px">Otros servicios y valores (se muestran al preguntar por precios; una línea por servicio)</label><textarea id="px" rows="6" maxlength="1200">${esc(s.prices_extra || '')}</textarea>
    <label for="rt">Respuesta sobre entrega de resultados (privacidad)</label><textarea id="rt" rows="4" maxlength="800">${esc(s.results_text)}</textarea>
    <h2 style="margin-top:1.2rem">Google Calendar (opcional)</h2>
    <label style="color:var(--ink)"><input type="checkbox" id="gce" style="width:auto" ${s.google_calendar?.enabled ? 'checked' : ''}> Sincronizar las citas con Google Calendar</label>
    <div class="grid2"><div><label for="gcid">ID del calendario predeterminado</label><input id="gcid" value="${esc(s.google_calendar?.default_calendar_id)}" placeholder="…@group.calendar.google.com" maxlength="200"></div>
    <div><label for="gts">Título de los eventos</label><select id="gts"><option value="name" ${s.google_calendar?.title_style !== 'initials' ? 'selected' : ''}>Nombre del paciente</option><option value="initials" ${s.google_calendar?.title_style === 'initials' ? 'selected' : ''}>Solo iniciales (más privado)</option></select></div></div>
    <p class="small muted">Los datos que salen hacia Google son el nombre (o iniciales) del paciente, la especialidad, el médico y la hora. Nunca el teléfono ni datos clínicos. Un calendario propio por médico se indica en la ficha de cada médico.</p>
    <h2 style="margin-top:1.2rem">Citas</h2><div class="grid2"><div><label for="rh">Recordatorio (horas antes)</label><input id="rh" type="number" min="1" max="168" value="${s.reminder_hours}"></div>
    <div><label for="mn">Anticipación mínima para reservar (horas)</label><input id="mn" type="number" min="0" max="72" value="${s.min_notice_hours}"></div>
    <div><label for="bw">Ventana de reserva (días)</label><input id="bw" type="number" min="1" max="90" value="${s.booking_window_days}"></div></div>
    <div class="actions"><button class="primary">Guardar cambios</button></div></form>
  <div class="card" id="gcs"><h2>Estado de Google Calendar</h2>
    ${gc.key_found ? `<p>🔑 Clave de la cuenta de servicio encontrada. <b>Comparta cada calendario</b> con este correo (permiso «Hacer cambios en eventos»):<br><code>${esc(gc.service_account_email)}</code></p>` : '<p class="alert warn">No se encontró la clave de la cuenta de servicio (<code>config/google-service-account.json</code>). Siga la guía <code>docs/GOOGLE_CALENDAR.md</code>.</p>'}
    <p>${gc.enabled ? '<span class="badge ok">Activada</span>' : '<span class="badge">Desactivada</span>'} · Citas sincronizadas: <b>${gc.synced}</b> · Pendientes: <b>${gc.pending}</b>${gc.gave_up ? ` · <span class="badge bad">${gc.gave_up} sin poder enviar</span>` : ''}</p>
    ${gc.last_error ? `<div class="alert urgent">Último error: ${esc(gc.last_error)}</div>` : ''}
    <div class="row"><button id="gsync">Sincronizar ahora</button><button id="gretry">Reintentar los fallidos</button><button id="gtest">Probar el calendario predeterminado</button></div>
    <div id="gmsg" class="small" style="margin-top:.5rem"></div></div>
  <div class="card"><h2>Usuarios</h2><div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.name)}${u.is_me ? ' <span class="muted small">(usted)</span>' : ''}</td><td>${esc(u.email)}</td><td>${u.role === 'admin' ? 'Administrador' : 'Recepcionista'}</td><td>${u.active ? (u.must_change ? '<span class="badge warn">Debe crear su contraseña</span>' : '<span class="badge ok">Activo</span>') : '<span class="badge">Desactivado</span>'}</td><td>${u.is_me ? '' : `<button data-reset="${u.id}" style="padding:.2rem .6rem">Restablecer contraseña</button> <button data-act="${u.id}" data-to="${u.active ? 0 : 1}" style="padding:.2rem .6rem">${u.active ? 'Desactivar' : 'Activar'}</button>`}</td></tr>`).join('')}</tbody></table></div>
    <form id="uf" class="row" style="margin-top:.8rem"><input class="grow" id="un" placeholder="Nombre" required><input class="grow" id="ue" type="email" placeholder="Correo" required><input class="grow" id="up" type="password" placeholder="Contraseña temporal (mín. 10)" minlength="10" required autocomplete="new-password"><select id="ur" style="width:auto"><option value="receptionist">Recepcionista</option><option value="admin">Administrador</option></select><button class="primary">Añadir</button></form></div>`;
  $('#cf').onsubmit = guard(async (e) => {
    e.preventDefault();
    const hours = {}; for (let d = 0; d < 7; d++) { const a = el.querySelector(`[data-d="${d}"][data-p="0"]`).value, b = el.querySelector(`[data-d="${d}"][data-p="1"]`).value; hours[d] = a && b ? [[a, b]] : []; }
    await api('PUT', '/api/clinic', { name: $('#cn').value, city: $('#cc').value, address: $('#ca').value, maps_url: $('#cm').value, settings: { hours, oncall_name: $('#gn').value, oncall_whatsapp: $('#gw').value, reception_whatsapp: $('#rw').value, emergency_number: $('#ge').value, assistant_name: $('#an').value, prices_extra: $('#px').value, results_text: $('#rt').value, google_calendar: { enabled: $('#gce').checked, default_calendar_id: $('#gcid').value, title_style: $('#gts').value }, reminder_hours: $('#rh').value, min_notice_hours: $('#mn').value, booking_window_days: $('#bw').value } });
    me = await api('GET', '/api/me'); toast('Configuración guardada'); renderShell(); route();
  });
  el.querySelectorAll('[data-act]').forEach((b) => b.onclick = guard(async () => {
    const off = b.dataset.to === '0';
    if (off && !confirm('¿Desactivar este usuario? No podrá ingresar y se cerrarán sus sesiones abiertas.')) return;
    await api('PATCH', `/api/users/${b.dataset.act}`, { active: !off }); toast(off ? 'Usuario desactivado' : 'Usuario activado'); route();
  }));
  el.querySelectorAll('[data-reset]').forEach((b) => b.onclick = () => {
    const m = modal(`<h2>Restablecer contraseña</h2><p class="muted">Escriba una contraseña temporal. La persona deberá crear una propia al ingresar.</p>
      <label for="rp">Contraseña temporal (mínimo 10 caracteres)</label><input id="rp" type="text" autocomplete="off" minlength="10">
      <div class="actions"><button id="rx">Cancelar</button><button class="primary" id="rs">Restablecer</button></div>`);
    $('#rx', m).onclick = m.close;
    $('#rs', m).onclick = guard(async () => { await api('PATCH', `/api/users/${b.dataset.reset}`, { password: $('#rp', m).value }); m.close(); toast('Contraseña restablecida'); route(); });
  });
  const gmsg = (t, bad) => { $('#gmsg').innerHTML = `<span class="badge ${bad ? 'bad' : 'ok'}">${esc(t)}</span>`; };
  $('#gsync').onclick = guard(async () => { const r = await api('POST', '/api/calendar/sync', {}); gmsg(r.error || `Enviadas ${r.processed}, con error ${r.failed}, pendientes ${r.pending}`, !r.ok); setTimeout(route, 1200); });
  $('#gretry').onclick = guard(async () => { const r = await api('POST', '/api/calendar/sync', { retry: true }); gmsg(r.error || `Enviadas ${r.processed}, con error ${r.failed}, pendientes ${r.pending}`, !r.ok); setTimeout(route, 1200); });
  $('#gtest').onclick = guard(async () => { const r = await api('POST', '/api/calendar/test', { calendar_id: $('#gcid').value }); gmsg(r.message, !r.ok); });
  $('#uf').onsubmit = guard(async (e) => { e.preventDefault(); await api('POST', '/api/users', { name: $('#un').value, email: $('#ue').value, password: $('#up').value, role: $('#ur').value }); toast('Usuario creado'); route(); });
}

// ───────────────────────── simulador de WhatsApp ─────────────────────────
let simPhone = '+593990000777', simAfter = 0;
async function viewSimulador(el) {
  simAfter = 0;
  el.innerHTML = `<div class="page-head"><div><h1>Simulador de WhatsApp</h1><div class="muted">Prueba el agente como si fueras un paciente. No se conecta a WhatsApp real ni se envían mensajes.</div></div></div>
  <div class="grid2"><div class="card"><div class="row"><div class="grow"><label for="ph" style="margin:0">Número del paciente (simulado)</label><input id="ph" value="${esc(simPhone)}" inputmode="tel"></div><button id="rs" style="align-self:flex-end">Reiniciar</button></div>
    <div id="st" class="small" style="margin:.5rem 0"></div>
    <div class="chat"><div class="msgs" id="sm"></div><form id="sf"><input id="si" placeholder="Escribe un mensaje…" autocomplete="off" maxlength="1000" aria-label="Mensaje"><button class="primary">Enviar</button></form></div>
    <div class="chips" id="ch"></div></div>
  <div class="card"><h2>Qué probar</h2><ul class="small" style="padding-left:1.1rem;line-height:1.7">
    <li><b>Agendar:</b> «Hola» → «4» → acepta el consentimiento → elige especialidad, médico y horario.</li>
    <li><b>Reagendar / cancelar</b> la cita recién creada.</li>
    <li><b>Disponibilidad:</b> «¿Hay turno con pediatría?»</li>
    <li><b>Información:</b> precios, horarios, ubicación, médicos.</li>
    <li><b>Servicios especiales:</b> «dentista» (deriva al WhatsApp del área o pasa a una persona), «laboratorio» o «rayos x» (sin cita), «mis resultados» (nunca se envían por WhatsApp).</li>
    <li><b>Seguridad:</b> «Tengo dolor fuerte en el pecho» (emergencia) o «¿qué tengo si me duele la cabeza?» (no diagnostica).</li>
    <li><b>Humano:</b> «Quiero hablar con una persona» → mira <a href="#/conversaciones">Conversaciones</a>, respóndele como recepción y mira la respuesta aquí.</li>
    <li><b>Recordatorios:</b> agenda una cita y pulsa el botón de abajo (si la cita está dentro de las horas configuradas).</li></ul>
    <button id="rm">⏰ Ejecutar recordatorios ahora</button>
    <p class="small muted">Los recordatorios también se ejecutan solos cada minuto.</p></div></div>`;
  const add = (m) => {
    const d = document.createElement('div'); d.className = 'bubble ' + (m.sender === 'patient' ? 'me' : m.sender === 'staff' ? 'staff' : '');
    d.innerHTML = `${rich(m.body)}<small>${m.sender === 'staff' ? 'Recepción' : m.sender === 'bot' ? 'MediConnect' : 'Tú'} · ${esc(new Date(m.created_at).toLocaleTimeString('es-EC', { timeZone: tz(), hour: '2-digit', minute: '2-digit' }))}</small>`;
    $('#sm').append(d); $('#sm').scrollTop = $('#sm').scrollHeight; simAfter = Math.max(simAfter, m.id);
  };
  const poll = guard(async () => {
    const r = await api('GET', `/api/simulator/messages?phone=${encodeURIComponent($('#ph').value)}&after=${simAfter}`);
    r.messages.forEach(add);
    $('#st').innerHTML = r.status === 'human' ? `<span class="badge warn">Derivado ${r.area ? 'al área de ' + esc(r.area) : 'a recepción'}: el agente no responde hasta que el personal lo devuelva</span>` : '<span class="badge info">Atiende el agente</span>';
  });
  const send = guard(async (text) => { simPhone = $('#ph').value; await api('POST', '/api/simulator/message', { phone: simPhone, text }); await poll(); });
  $('#sf').onsubmit = (e) => { e.preventDefault(); const t = $('#si').value.trim(); if (t) { $('#si').value = ''; send(t); } };
  $('#ph').onchange = () => { simPhone = $('#ph').value; simAfter = 0; $('#sm').innerHTML = ''; poll(); };
  $('#rs').onclick = guard(async () => { await api('POST', '/api/simulator/reset', { phone: $('#ph').value }); toast('Conversación reiniciada (el historial se conserva)'); });
  $('#rm').onclick = guard(async () => { const r = await api('POST', '/api/jobs/reminders'); toast(`${r.sent} recordatorio(s) generado(s)`); poll(); });
  $('#ch').innerHTML = ['Hola', 'Quiero agendar una cita', '¿Hay turno con pediatría?', '¿Cuánto cuesta la consulta?', '¿Dónde están ubicados?', 'Quiero una cita con el dentista', '¿Necesito cita para el laboratorio?', 'Mis resultados', 'Tengo dolor fuerte en el pecho', '¿Qué tengo si me duele la cabeza?', 'Quiero hablar con una persona', 'Reagendar mi cita', 'Cancelar mi cita', 'CONFIRMO'].map((t) => `<button type="button">${esc(t)}</button>`).join('');
  $('#ch').querySelectorAll('button').forEach((b) => b.onclick = () => send(b.textContent));
  await poll(); every(poll, 2500);
}

const VIEWS = { resumen: viewResumen, calendario: viewCalendario, conversaciones: viewConversaciones, pacientes: viewPacientes, medicos: viewMedicos, especialidades: viewEspecialidades, alertas: viewAlertas, estadisticas: viewEstadisticas, configuracion: viewConfiguracion, simulador: viewSimulador };

// Cambio de contraseña. Con clave temporal (primer ingreso o restablecida) es obligatorio y no se puede cerrar.
function passwordModal(forced) {
  const m = modal(`<h2>${forced ? 'Cree su contraseña' : 'Cambiar mi contraseña'}</h2>
    ${forced ? '<p class="muted">Está usando una contraseña temporal. Por seguridad, cree una propia para continuar.</p>' : ''}
    <label for="pc">Contraseña actual${forced ? ' (la temporal)' : ''}</label><input id="pc" type="password" autocomplete="current-password">
    <label for="pn">Contraseña nueva (mínimo 10 caracteres)</label><input id="pn" type="password" autocomplete="new-password" minlength="10">
    <label for="pr">Repita la contraseña nueva</label><input id="pr" type="password" autocomplete="new-password">
    <div class="err" id="pe" role="alert"></div>
    <div class="actions">${forced ? '<button id="px">Cerrar sesión</button>' : '<button id="px">Cancelar</button>'}<button class="primary" id="ps">Guardar contraseña</button></div>`, { closable: !forced });
  $('#px', m).onclick = forced ? async () => { await api('POST', '/api/logout'); me = null; m.close(); renderLogin(); } : m.close;
  $('#ps', m).onclick = async () => {
    try {
      if ($('#pn', m).value !== $('#pr', m).value) throw new Error('Las contraseñas nuevas no coinciden');
      await api('POST', '/api/me/password', { current: $('#pc', m).value, password: $('#pn', m).value });
      m.close(); toast('Contraseña cambiada');
      if (forced) { me = await api('GET', '/api/me'); renderShell(); route(); }
    } catch (e) { $('#pe', m).textContent = e.message; }
  };
}

async function boot() {
  try { me = await api('GET', '/api/me'); } catch { return renderLogin(); }
  renderShell();
  if (me.user.must_change) return passwordModal(true);   // hasta cambiarla, el panel no carga datos
  route();
}
window.addEventListener('hashchange', () => me && route());
boot();
