// Página pública de política de privacidad (requisito de Meta para publicar la app de WhatsApp).
// Toma nombre, dirección y ciudad de la clínica desde la base: no contiene datos reales en el código.
// BORRADOR: debe revisarlo el asesor legal del centro antes de considerarlo definitivo (LOPDP, Ecuador).
import type { Clinic } from './services/clinic.ts';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const PRIVACY_UPDATED = '13 de octubre de 2026';

export function privacyPage(clinic: Pick<Clinic, 'name' | 'address' | 'city'>): string {
  const name = esc(clinic.name);
  const place = esc([clinic.address, clinic.city].filter(Boolean).join(', '));
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de privacidad — ${name}</title>
<style>
  body{font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2933;background:#f7f9fb;margin:0}
  main{max-width:760px;margin:0 auto;padding:24px 16px 48px;background:#fff}
  h1{font-size:1.6rem;margin:.2em 0}h2{font-size:1.15rem;margin-top:1.8em;color:#0b5e7e}
  .muted{color:#5f6b76;font-size:.9rem}ul{padding-left:1.2em}li{margin:.25em 0}
  .box{background:#eef6f9;border-left:4px solid #0b5e7e;padding:.8em 1em;border-radius:4px}
</style></head>
<body><main>
<h1>Política de privacidad</h1>
<p class="muted">Asistente de citas por WhatsApp «MediConnect» de <b>${name}</b>${place ? ` · ${place}` : ''}. Última actualización: ${PRIVACY_UPDATED}.</p>

<div class="box">En resumen: usamos su nombre y su número de WhatsApp solo para gestionar sus citas. No le pedimos información médica por este medio, no vendemos sus datos y puede pedir que los eliminemos cuando quiera.</div>

<h2>1. Responsable del tratamiento</h2>
<p><b>${name}</b>${place ? `, con domicilio en ${place}` : ''}, es responsable de los datos personales que se tratan a través de su asistente de WhatsApp, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP) y su reglamento.</p>

<h2>2. Qué datos tratamos</h2>
<ul>
  <li><b>Identificación y contacto:</b> nombre y apellido, y número de teléfono de WhatsApp.</li>
  <li><b>Datos de la cita:</b> especialidad o servicio, profesional, fecha, hora y estado (agendada, confirmada, cancelada o reagendada).</li>
  <li><b>Mensajes</b> que usted intercambia con el asistente o con el personal del centro por este canal.</li>
  <li><b>Familiares:</b> si agenda para otra persona (por ejemplo, un hijo), su nombre y sus citas. Al hacerlo, usted declara ser su representante o contar con su autorización.</li>
  <li><b>Registro de su autorización:</b> fecha y versión del aviso que aceptó.</li>
</ul>
<p>El asistente <b>no solicita</b> diagnósticos, síntomas, resultados ni otra información de salud. Le pedimos no enviarla por este medio. Tampoco procesamos audios, fotos ni documentos: si los envía, se le pide escribir en texto y el archivo no se guarda.</p>

<h2>3. Para qué los usamos</h2>
<ul>
  <li>Agendar, confirmar, reagendar o cancelar sus citas.</li>
  <li>Enviarle recordatorios de sus citas.</li>
  <li>Informarle horarios, servicios, precios y ubicación del centro.</li>
  <li>Comunicarlo con una persona del centro cuando lo solicite.</li>
  <li>Orientarlo a llamar al 911 si su mensaje indica una posible emergencia.</li>
</ul>
<p>No usamos sus datos para publicidad ni para tomar decisiones automatizadas sobre su atención médica.</p>

<h2>4. Base legal</h2>
<p>Su <b>consentimiento</b>, que se le solicita al inicio de la conversación antes de registrar sus datos, y la gestión de la relación de atención que usted solicita. Puede retirar su consentimiento en cualquier momento.</p>

<h2>5. Con quién se comparten</h2>
<p>No vendemos ni cedemos sus datos. Solo intervienen proveedores que prestan el servicio técnico, bajo sus propias condiciones de seguridad:</p>
<ul>
  <li><b>Meta Platforms (WhatsApp Business Platform):</b> transmite los mensajes entre usted y el centro.</li>
  <li><b>Proveedor de servidores</b> donde funciona el sistema del centro.</li>
  <li><b>Google Calendar</b>, cuando el centro lo usa para organizar la agenda de los profesionales: se registra el nombre del paciente (o sus iniciales), la especialidad, el profesional y el horario de la cita.</li>
</ul>
<p>Algunos de estos proveedores pueden almacenar información fuera del Ecuador. El acceso del personal del centro al sistema es individual, con usuario y contraseña propios.</p>

<h2>6. Cuánto tiempo los conservamos</h2>
<p>Mientras tenga citas activas o una relación de atención con el centro, y luego el tiempo que exijan las obligaciones legales aplicables. Las copias de seguridad del sistema se eliminan automáticamente a los 30 días. Si solicita la eliminación, sus datos se anonimizan de inmediato en el sistema.</p>

<h2 id="derechos">7. Sus derechos</h2>
<p>Puede solicitar en cualquier momento el <b>acceso</b>, la <b>rectificación</b>, la <b>eliminación</b>, la <b>oposición</b>, la <b>portabilidad</b> o la <b>suspensión</b> del tratamiento de sus datos, y retirar su consentimiento. Responderemos dentro de los plazos de la LOPDP. Si considera que no fue atendido, puede acudir a la Superintendencia de Protección de Datos Personales.</p>

<h2 id="eliminacion">8. Cómo pedir la eliminación de sus datos</h2>
<ol>
  <li>Escriba <b>«recepción»</b> al WhatsApp del centro y pida la eliminación de sus datos, o acérquese a nuestras instalaciones${place ? ` (${place})` : ''}.</li>
  <li>El personal confirmará que la solicitud viene del mismo número de WhatsApp registrado.</li>
  <li>Sus datos se anonimizan en el sistema: se borran su nombre, su número y sus mensajes, se cancelan sus citas futuras y se retiran de los calendarios del centro. Si es titular del número, también se eliminan los familiares registrados bajo él.</li>
</ol>
<p>La información que el centro deba conservar por obligación legal (por ejemplo, la historia clínica, que no se gestiona en este asistente) se rige por la normativa sanitaria correspondiente.</p>

<h2>9. Seguridad</h2>
<p>El sistema funciona con conexión cifrada (HTTPS), acceso restringido del personal, contraseñas protegidas y copias de seguridad diarias. Las credenciales técnicas no se guardan en el código del sistema.</p>

<h2>10. Cambios</h2>
<p>Si actualizamos esta política, publicaremos la nueva versión en esta misma dirección, con su fecha.</p>
</main></body></html>`;
}
