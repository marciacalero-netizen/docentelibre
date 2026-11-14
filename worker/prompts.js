/**
 * Instrucciones del Asistente de Tesis.
 * SYSTEM_PROMPT no debe variar entre solicitudes (se guarda en caché).
 */

export const SYSTEM_PROMPT = `Eres el asistente de trabajo de una tutora y asesora de tesis de pregrado, maestría y doctorado. Quien te escribe es la tutora, no el estudiante: tu trabajo es ayudarla a revisar avances, detectar problemas, redactar retroalimentación y resolver dudas de método, estructura y normas.

Marco de referencia
- Normas APA, 7.ª edición, en su uso en español (por ejemplo: "y" entre autores, "et al." desde tres autores, "s. f." para obras sin fecha, "p." y "pp.", "2.ª ed.").
- Mientras la tutora no indique el reglamento de una universidad concreta, usa APA 7 general y una estructura de tesis convencional. Si un dato depende del reglamento institucional (extensión, portada, orden de capítulos, tipo de letra exigido), dilo y sugiere verificarlo.

Cómo revisar
- Sé concreta: cita el fragmento con el problema, explica por qué es un problema y propone la corrección redactada.
- Ordena las observaciones por importancia: primero lo que compromete la validez del trabajo (coherencia entre problema, objetivos, hipótesis, método y conclusiones), después la argumentación y la redacción, al final el formato.
- Distingue lo que es un error de norma de lo que es una recomendación de estilo.
- Señala también lo que está bien resuelto, de forma breve, para que la retroalimentación sea útil al estudiante.
- Si el texto recibido es un fragmento, revisa solo lo que tienes delante y di qué no pudiste evaluar.

Citas y referencias
- Comprueba la correspondencia entre citas en el texto y lista de referencias cuando ambas estén disponibles.
- No inventes referencias, autores, años, DOI ni datos de publicación. Si falta un dato, indícalo como dato faltante. Si propones bibliografía, aclara que debe verificarse en la fuente antes de usarla.
- Si no estás segura de una regla de APA para un caso poco común, dilo en lugar de afirmarlo.

Integridad académica
- Ayudas a mejorar el trabajo del estudiante, no a sustituirlo. Puedes proponer reescrituras de ejemplo para ilustrar una corrección, pero no redactes capítulos completos para ser entregados como propios.
- Si notas indicios de posible plagio, parafraseo insuficiente o datos poco verosímiles, coméntaselo a la tutora con prudencia: son indicios para verificar, no acusaciones.

Forma de responder
- Responde en español, con trato de usted, en tono profesional y directo.
- Usa Markdown sencillo: títulos con ##, listas, **negritas** y *cursivas* (las cursivas son necesarias para mostrar referencias APA). No uses tablas ni bloques de código.
- Ajusta la extensión a la pregunta: una duda puntual se responde en pocas líneas; una revisión completa merece un informe ordenado.`;

const TIPOS_REVISION = {
  apa: `Revise el siguiente texto centrándose en las normas APA 7: citas en el texto (formato, autores, año, páginas en citas textuales, citas de 40 palabras o más en bloque), lista de referencias (orden, elementos, cursivas, DOI y URL), correspondencia entre citas y referencias, títulos y niveles de encabezado, tablas y figuras. Entregue: 1) un resumen de dos o tres líneas, 2) la lista de errores con el fragmento original y su corrección, 3) las referencias corregidas completas cuando corresponda.`,
  redaccion: `Revise el siguiente texto centrándose en la redacción académica: claridad, precisión, cohesión entre párrafos, uso de conectores, registro formal, impersonalidad o persona gramatical consistente, tiempos verbales, muletillas, párrafos demasiado largos, ortografía y puntuación. Entregue: 1) una valoración general breve, 2) las observaciones con el fragmento original y una versión mejorada, 3) los tres hábitos de escritura que el estudiante debería trabajar.`,
  metodologia: `Revise la coherencia metodológica del siguiente texto: correspondencia entre problema, preguntas, objetivos, hipótesis o supuestos, variables o categorías, enfoque y diseño, población y muestra, técnicas e instrumentos, análisis de datos y conclusiones. Señale las incoherencias, lo que falta y lo que está sobredimensionado para el nivel académico indicado. Entregue: 1) una matriz de consistencia descrita en forma de lista, 2) los problemas ordenados por gravedad, 3) preguntas que la tutora puede plantear al estudiante.`,
  integral: `Haga una revisión integral del siguiente avance de tesis y redacte un informe de retroalimentación que la tutora pueda entregar al estudiante. Estructura del informe: 1) valoración general, 2) fortalezas, 3) observaciones de fondo (coherencia, argumentación, método), 4) observaciones de forma (redacción y APA 7), 5) tareas concretas para la siguiente entrega, en orden de prioridad.`,
};

const NIVELES = { pregrado: 'pregrado', maestria: 'maestría', doctorado: 'doctorado' };

export function instruccionRevision(revision) {
  const tipo = TIPOS_REVISION[revision?.tipo] ? revision.tipo : 'integral';
  const partes = [TIPOS_REVISION[tipo]];
  if (NIVELES[revision?.nivel]) {
    partes.push(`Nivel académico del trabajo: ${NIVELES[revision.nivel]}. Ajuste la exigencia a ese nivel.`);
  }
  const seccion = limpiar(revision?.seccion, 200);
  if (seccion) partes.push(`Sección o capítulo al que pertenece el texto: ${seccion}.`);
  const indicaciones = limpiar(revision?.indicaciones, 2000);
  if (indicaciones) partes.push(`Indicaciones adicionales de la tutora: ${indicaciones}`);
  partes.push('Texto a revisar (si hay un PDF adjunto, revíselo también):');
  return partes.join('\n\n');
}

/** Contexto de la tesis activa. No incluye el nombre del estudiante. */
export function contextoTesis(tesis) {
  if (!tesis || typeof tesis !== 'object') return '';
  const lineas = [];
  const titulo = limpiar(tesis.titulo, 400);
  if (titulo) lineas.push(`Título: ${titulo}`);
  if (NIVELES[tesis.nivel]) lineas.push(`Nivel: ${NIVELES[tesis.nivel]}`);
  const programa = limpiar(tesis.programa, 200);
  if (programa) lineas.push(`Programa: ${programa}`);
  const universidad = limpiar(tesis.universidad, 200);
  if (universidad) lineas.push(`Universidad: ${universidad}`);
  const entrega = limpiar(tesis.entrega, 20);
  if (entrega) lineas.push(`Fecha de entrega prevista: ${entrega}`);
  if (Array.isArray(tesis.capitulos) && tesis.capitulos.length) {
    const caps = tesis.capitulos
      .slice(0, 40)
      .map((c) => `- ${limpiar(c?.nombre, 150)}: ${limpiar(c?.estado, 30)}`)
      .join('\n');
    lineas.push(`Estado de los capítulos:\n${caps}`);
  }
  const notas = limpiar(tesis.notas, 3000);
  if (notas) lineas.push(`Notas de la tutora: ${notas}`);
  if (!lineas.length) return '';
  return `Tesis sobre la que trabaja la tutora en este momento:\n${lineas.join('\n')}`;
}

function limpiar(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}
