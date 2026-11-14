/**
 * DOCENTE LIBRE — Asistente de Tesis: contenido de referencia
 * Estructuras por nivel, guía de formato APA 7 y lista de verificación.
 * Editar aquí para adaptar el asistente al reglamento de una universidad.
 */

const NIVELES = { pregrado: 'Pregrado', maestria: 'Maestría', doctorado: 'Doctorado' };

const ESTADOS = [
  { id: 'pendiente', nombre: 'Pendiente', peso: 0 },
  { id: 'redaccion', nombre: 'En redacción', peso: 0.35 },
  { id: 'revision', nombre: 'En revisión', peso: 0.6 },
  { id: 'correcciones', nombre: 'Con correcciones', peso: 0.8 },
  { id: 'aprobado', nombre: 'Aprobado', peso: 1 },
];

const PRELIMINARES = {
  nombre: 'Páginas preliminares',
  guia: [
    'Portada con título, autor, programa, institución, tutor y fecha.',
    'Resumen de 150 a 250 palabras en un solo párrafo, con palabras clave.',
    'Abstract y keywords en inglés.',
    'Índice general, índice de tablas e índice de figuras.',
    'Dedicatoria y agradecimientos (opcionales).',
  ],
};

const CIERRE = [
  {
    nombre: 'Referencias',
    guia: [
      'Solo figuran las fuentes citadas en el texto, y todas las citadas figuran.',
      'Orden alfabético por apellido del primer autor, con sangría francesa.',
      'DOI o URL presentados como enlace completo (https://doi.org/...).',
    ],
  },
  {
    nombre: 'Anexos',
    guia: [
      'Instrumentos, consentimiento informado, validaciones y permisos.',
      'Cada anexo con letra y título (Anexo A, Anexo B) y mencionado en el texto.',
    ],
  },
];

const ESTRUCTURAS = {
  pregrado: [
    PRELIMINARES,
    {
      nombre: 'Capítulo I. Planteamiento del problema',
      guia: [
        'Descripción de la situación problemática, de lo general a lo particular.',
        'Formulación del problema: pregunta general y preguntas específicas.',
        'Objetivo general y objetivos específicos, redactados con verbos en infinitivo y medibles.',
        'Justificación: relevancia teórica, práctica y social.',
        'Delimitación (espacio, tiempo, población) y viabilidad.',
      ],
    },
    {
      nombre: 'Capítulo II. Marco teórico',
      guia: [
        'Antecedentes: estudios previos nacionales e internacionales, preferentemente de los últimos cinco años.',
        'Bases teóricas organizadas por variable o categoría.',
        'Definición de términos básicos.',
        'Hipótesis y variables, si el enfoque lo requiere.',
      ],
    },
    {
      nombre: 'Capítulo III. Metodología',
      guia: [
        'Enfoque, tipo y diseño de la investigación, con sustento en autores.',
        'Población, muestra y tipo de muestreo.',
        'Técnicas e instrumentos de recolección; validez y confiabilidad.',
        'Procedimiento y técnicas de análisis de datos.',
        'Consideraciones éticas.',
      ],
    },
    {
      nombre: 'Capítulo IV. Resultados',
      guia: [
        'Resultados ordenados según los objetivos específicos.',
        'Tablas y figuras numeradas, con título y nota, comentadas en el texto.',
        'Discusión breve frente a los antecedentes y la teoría.',
      ],
    },
    {
      nombre: 'Capítulo V. Conclusiones y recomendaciones',
      guia: [
        'Una conclusión por cada objetivo, derivada de los resultados.',
        'Recomendaciones concretas y aplicables.',
      ],
    },
    ...CIERRE,
  ],

  maestria: [
    PRELIMINARES,
    {
      nombre: 'Capítulo I. Introducción y problema de investigación',
      guia: [
        'Contexto y problematización con evidencia actual.',
        'Preguntas de investigación y objetivos alineados entre sí.',
        'Justificación y aporte esperado al campo profesional o disciplinar.',
        'Alcances y limitaciones del estudio.',
      ],
    },
    {
      nombre: 'Capítulo II. Marco teórico y estado del arte',
      guia: [
        'Estado del arte: revisión crítica de la literatura reciente, no un listado de resúmenes.',
        'Marco teórico y conceptual que sostiene las variables o categorías.',
        'Vacío de conocimiento que el estudio busca atender.',
        'Hipótesis o supuestos y operacionalización de variables o sistema de categorías.',
      ],
    },
    {
      nombre: 'Capítulo III. Metodología',
      guia: [
        'Paradigma, enfoque, alcance y diseño justificados.',
        'Participantes: población, muestra, criterios de inclusión y exclusión.',
        'Instrumentos con evidencias de validez y confiabilidad, o criterios de rigor cualitativo.',
        'Procedimiento y plan de análisis coherente con los objetivos.',
        'Consideraciones éticas y consentimiento informado.',
      ],
    },
    {
      nombre: 'Capítulo IV. Resultados',
      guia: [
        'Presentación ordenada por objetivo o por categoría.',
        'Análisis descriptivo e inferencial, o análisis cualitativo con evidencias textuales.',
        'Tablas y figuras en formato APA.',
      ],
    },
    {
      nombre: 'Capítulo V. Discusión',
      guia: [
        'Interpretación de los resultados frente al marco teórico y los antecedentes.',
        'Explicación de coincidencias y discrepancias con otros estudios.',
        'Implicaciones teóricas y prácticas; limitaciones del estudio.',
      ],
    },
    {
      nombre: 'Capítulo VI. Conclusiones y recomendaciones',
      guia: [
        'Conclusiones que responden a cada objetivo sin repetir resultados.',
        'Recomendaciones y líneas de investigación futuras.',
        'Propuesta de intervención o mejora, si el programa la exige.',
      ],
    },
    ...CIERRE,
  ],

  doctorado: [
    PRELIMINARES,
    {
      nombre: 'Capítulo I. Introducción',
      guia: [
        'Problema de investigación situado en el debate científico actual.',
        'Preguntas, objetivos e hipótesis o tesis que se defiende.',
        'Justificación de la originalidad y del aporte al conocimiento.',
        'Estructura del documento.',
      ],
    },
    {
      nombre: 'Capítulo II. Estado del arte',
      guia: [
        'Revisión sistemática o exhaustiva de la literatura, con criterios de búsqueda explícitos.',
        'Síntesis crítica: tendencias, debates, vacíos y contradicciones.',
        'Posicionamiento del estudio frente a ese estado de la cuestión.',
      ],
    },
    {
      nombre: 'Capítulo III. Marco teórico y epistemológico',
      guia: [
        'Fundamentos epistemológicos y ontológicos de la investigación.',
        'Teorías de base discutidas críticamente, no solo descritas.',
        'Modelo teórico o conceptual propio que guía el estudio.',
      ],
    },
    {
      nombre: 'Capítulo IV. Metodología',
      guia: [
        'Diseño justificado en profundidad y coherente con la postura epistemológica.',
        'Participantes, fuentes o corpus, y estrategia de muestreo.',
        'Instrumentos: construcción, validación y propiedades psicométricas o criterios de rigor.',
        'Procedimiento, plan de análisis y manejo de datos.',
        'Aprobación ética y gestión de riesgos.',
      ],
    },
    {
      nombre: 'Capítulo V. Resultados',
      guia: [
        'Resultados completos, organizados por objetivo, estudio o fase.',
        'Análisis con el nivel de sofisticación propio del doctorado.',
        'Evidencias suficientes para sostener la tesis defendida.',
      ],
    },
    {
      nombre: 'Capítulo VI. Discusión',
      guia: [
        'Diálogo de los hallazgos con la teoría y el estado del arte.',
        'Explicaciones alternativas y alcance de las inferencias.',
        'Limitaciones tratadas con honestidad metodológica.',
      ],
    },
    {
      nombre: 'Capítulo VII. Aporte original',
      guia: [
        'Formulación explícita de la contribución teórica, metodológica o aplicada.',
        'Modelo, teoría o propuesta derivada del estudio.',
        'Implicaciones para la disciplina y para la práctica.',
      ],
    },
    {
      nombre: 'Capítulo VIII. Conclusiones y líneas futuras',
      guia: [
        'Respuesta a las preguntas de investigación y contraste de hipótesis.',
        'Líneas de investigación que se abren a partir de la tesis.',
        'Publicaciones derivadas (artículos, ponencias), si el programa las exige.',
      ],
    },
    ...CIERRE,
  ],
};

const FORMATO_APA = [
  {
    titulo: 'Página y tipografía',
    items: [
      'Papel tamaño carta (21,59 × 27,94 cm) y márgenes de 2,54 cm en los cuatro lados.',
      'Fuentes admitidas: Times New Roman 12, Arial 11, Calibri 11, Georgia 11 o Lucida Sans Unicode 10. Una sola fuente en todo el documento.',
      'Interlineado doble en todo el texto, incluidas las referencias; sin espacio adicional entre párrafos.',
      'Texto alineado a la izquierda, sin justificar, con sangría de 1,27 cm en la primera línea de cada párrafo.',
      'Número de página en la esquina superior derecha desde la portada.',
    ],
  },
  {
    titulo: 'Títulos y niveles de encabezado',
    items: [
      'Nivel 1: centrado, en negrita, con mayúscula inicial en las palabras principales.',
      'Nivel 2: alineado a la izquierda, en negrita.',
      'Nivel 3: alineado a la izquierda, en negrita y cursiva.',
      'Nivel 4: con sangría, en negrita, con punto final; el texto sigue en la misma línea.',
      'Nivel 5: con sangría, en negrita y cursiva, con punto final; el texto sigue en la misma línea.',
      'No se numeran los títulos ni se usa «Introducción» como encabezado del primer apartado, salvo que el reglamento lo pida.',
    ],
  },
  {
    titulo: 'Citas en el texto',
    items: [
      'Cita parentética: (Apellido, año). Cita narrativa: Apellido (año).',
      'Dos autores: se citan siempre ambos, unidos por «y». Tres o más autores: primer apellido seguido de «et al.» desde la primera cita.',
      'Cita textual de menos de 40 palabras: entre comillas, con autor, año y página (p. 23 o pp. 23-24).',
      'Cita textual de 40 palabras o más: en bloque aparte, con sangría de 1,27 cm, sin comillas, y la referencia después del punto final.',
      'Varias obras en un mismo paréntesis: en orden alfabético y separadas por punto y coma.',
      'Fuente secundaria: (Piaget, 1970, como se citó en Flavell, 1996). En la lista solo figura la obra consultada.',
      'Comunicaciones personales: se citan en el texto y no van en la lista de referencias.',
      'Obras sin fecha: (Apellido, s. f.). Mismo autor y año: se distinguen con letras (2020a, 2020b).',
    ],
  },
  {
    titulo: 'Lista de referencias',
    items: [
      'Título «Referencias» centrado y en negrita, en página nueva.',
      'Sangría francesa de 1,27 cm e interlineado doble.',
      'Orden alfabético por apellido del primer autor; obras del mismo autor, por año.',
      'Hasta 20 autores se escriben todos; con 21 o más, los primeros 19, puntos suspensivos y el último.',
      'En cursiva: títulos de libros, tesis, informes y páginas web; nombre y volumen de la revista.',
      'Ya no se escribe la ciudad de la editorial ni «Recuperado de» antes de la URL.',
      'El DOI se presenta como enlace: https://doi.org/10.xxxx/xxxxx',
    ],
  },
  {
    titulo: 'Tablas y figuras',
    items: [
      'Número en negrita (Tabla 1, Figura 1) y, en la línea siguiente, el título en cursiva.',
      'Tablas sin líneas verticales; solo las horizontales necesarias.',
      'Nota al pie de la tabla o figura para la fuente, las abreviaturas y las aclaraciones.',
      'Toda tabla o figura se menciona en el texto por su número antes de aparecer.',
      'Si se toma o adapta de otra fuente, la nota lo indica y la fuente va en las referencias.',
    ],
  },
  {
    titulo: 'Estilo de redacción',
    items: [
      'Lenguaje claro, preciso y sin sesgos; tiempos verbales consistentes en cada sección.',
      'Pasado para describir el método y los resultados; presente para discutir implicaciones y conclusiones.',
      'Números del cero al nueve con letras; del 10 en adelante con cifras, con las excepciones de la norma.',
      'Las siglas se desarrollan la primera vez que aparecen.',
      'Cursiva para términos clave en su primera aparición y para títulos; no se usa el subrayado.',
    ],
  },
];

const CHECKLIST_REVISION = [
  {
    grupo: 'Coherencia interna',
    items: [
      'El título refleja las variables o categorías, la población y el contexto.',
      'Cada pregunta de investigación tiene su objetivo correspondiente.',
      'Las hipótesis o supuestos se derivan del marco teórico.',
      'El diseño metodológico permite alcanzar los objetivos.',
      'Las conclusiones responden a los objetivos y se apoyan en los resultados.',
    ],
  },
  {
    grupo: 'Marco teórico',
    items: [
      'Los antecedentes son recientes y pertinentes.',
      'Las fuentes son académicas y, en su mayoría, primarias.',
      'El texto integra y discute a los autores; no es una suma de citas.',
      'Cada variable o categoría tiene sustento teórico.',
    ],
  },
  {
    grupo: 'Metodología y ética',
    items: [
      'La muestra y el muestreo están descritos y justificados.',
      'Los instrumentos cuentan con validez y confiabilidad reportadas.',
      'El procedimiento permite replicar el estudio.',
      'Hay consentimiento informado y resguardo de datos.',
    ],
  },
  {
    grupo: 'Citas y referencias',
    items: [
      'Toda cita del texto aparece en la lista de referencias, y viceversa.',
      'Las citas textuales llevan número de página.',
      'Las referencias están completas y en formato APA 7.',
      'Se revisó la originalidad con un programa de detección de similitud.',
    ],
  },
  {
    grupo: 'Formato y redacción',
    items: [
      'Márgenes, fuente, interlineado y sangrías conformes a la norma.',
      'Niveles de título usados de forma consistente.',
      'Tablas y figuras numeradas, tituladas y citadas en el texto.',
      'Resumen y abstract dentro del límite de palabras, con palabras clave.',
      'Ortografía, puntuación y concordancia revisadas.',
    ],
  },
];
