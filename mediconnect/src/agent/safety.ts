import { normalize } from '../util.ts';

// Guardarraíles de seguridad: se evalúan SIEMPRE antes que cualquier otra intención.
// Deliberadamente conservadores: ante la duda, se orienta al paciente a emergencias.

const SELF_HARM = /(me quiero morir|quiero morirme|quitarme la vida|quiero matarme|suicid|hacerme dano|no quiero vivir)/;
const EMERGENCY = [
  /dolor (fuerte |intenso |agudo )?(de|en el|en mi) pecho/, /opresion (en el |del )?pecho/,
  /no (puedo|puede|pueden|logro|logra) respirar/, /\bno respira\b/, /dificultad (para|al) respirar/, /falta de aire/, /me ahogo/,
  /desmay/, /inconsciente/, /perdi el conocimiento/, /no reacciona/, /no responde/,
  /convulsion/, /ataque epileptico/,
  /sangrado (abundante|intenso|fuerte|que no para)/, /hemorragia/, /vomit\w* sangre/,
  /accidente/, /atropell/, /quemadura (grave|fuerte)/, /fractura expuesta/,
  /infarto/, /derrame cerebral/, /\bictus\b/, /paro (cardiaco|respiratorio)/,
  /envenen/, /sobredosis/, /intoxic/,
  /cara torcida/, /no puedo hablar/, /no siento (el|mi) (brazo|pierna)/, /paralisis/,
  /reaccion alergica (grave|fuerte)/, /se me hincha (la garganta|la lengua)/,
  /\bemergencia\b/, /\bambulancia\b/,
];
const DIAGNOSIS = [
  /que (tengo|enfermedad|puede ser)/, /diagnostic/, /es grave/, /sera (grave|cancer)/,
  /\breceta\b/, /\bdosis\b/, /cuanto (debo|puedo) tomar/, /puedo tomar/, /que (medicina|medicamento|pastilla|antibiotico) (tomo|me|debo)/,
  /\bsintoma/, /me duele/, /tengo (fiebre|dolor|tos|mareo|nauseas|vomito|alergia|infeccion|una mancha|un bulto)/,
  /interpret/, /(que significa|es normal|salio (alto|bajo)|que dicen?).*(resultado|examen)/,
];

export type Safety = 'self_harm' | 'emergency' | 'diagnosis' | null;

export function assessSafety(text: string): Safety {
  const n = normalize(text);
  if (SELF_HARM.test(n)) return 'self_harm';
  if (EMERGENCY.some((r) => r.test(n))) return 'emergency';
  if (DIAGNOSIS.some((r) => r.test(n))) return 'diagnosis';
  return null;
}

export function emergencyReply(kind: 'self_harm' | 'emergency', emergencyNumber: string): string {
  if (kind === 'self_harm') {
    return `Lamento mucho que estés pasando por esto. Tu seguridad es lo más importante y no tienes que enfrentarlo en soledad.\n\n🚨 *Llama ahora al ${emergencyNumber} (ECU 911)* o pide a alguien cercano que te acompañe y acude al servicio de emergencias más próximo.\n\nHe avisado al personal de la clínica para que pueda contactarte por este chat.`;
  }
  return `🚨 *Lo que describes puede ser una emergencia médica.*\n\nPor favor *llama de inmediato al ${emergencyNumber} (ECU 911)* o acude ahora al servicio de emergencias más cercano. No esperes una respuesta por este chat.\n\nEste asistente no puede evaluar urgencias ni dar indicaciones médicas. He avisado al personal de la clínica.`;
}

export const diagnosisReply = (emergencyNumber: string): string =>
  `Entiendo tu preocupación 💙, pero *no puedo dar diagnósticos, interpretar síntomas ni recomendar medicamentos*. Eso solo lo puede hacer un médico evaluándote en consulta. No necesitas darme detalles clínicos por aquí.\n\nSi lo deseas, puedo agendarte una cita (escribe *1*). Si sientes que empeora o es grave, llama al *${emergencyNumber}* (ECU 911).`;
