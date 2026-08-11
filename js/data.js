/**
 * DOCENTE LIBRE — Capa de contenido
 * Todo el contenido (artículos, guías, libro, config) vive aquí, separado
 * del HTML/CSS, para poder crecer fácilmente o migrar a un backend/WordPress
 * sin rediseñar las plantillas.
 *
 * Contenido de demostración: sustituir por contenido real cuando esté listo.
 */

/* ==========================================================================
   CONFIGURACIÓN / INTEGRACIONES PENDIENTES
   Rellenar estas variables cuando existan los recursos reales.
   ========================================================================== */
const SITE_CONFIG = {
  siteName: 'Docente Libre',
  siteUrl: 'https://docentelibre.com', // TODO: reemplazar por el dominio real
  contactEmail: 'hola@docentelibre.com', // TODO: confirmar email real

  // URL real del PDF de la guía gratuita. Mientras esté vacío, el formulario
  // confirma el registro pero NO ofrece una descarga (no se simulan descargas).
  FREE_GUIDE_URL: 'assets/descargas/guias-pdf/7-senales-celular-pasatiempo.pdf',

  // Endpoint de envío de formularios (Brevo, Mailchimp, Formspree, backend propio...).
  // Mientras esté vacío, los formularios validan y muestran confirmación en pantalla,
  // pero no envían datos a ningún servicio externo.
  FORM_ENDPOINT: '',

  // URL de compra del libro (Amazon u otra plataforma). Vacío hasta tener el enlace real.
  BOOK_PURCHASE_URL: '',

  social: {
    instagram: '',
    facebook: '',
    youtube: '',
    tiktok: ''
  }
};

/* ==========================================================================
   CATEGORÍAS
   ========================================================================== */
const CATEGORIES = {
  adolescencia: {
    slug: 'adolescencia',
    label: 'Adolescencia',
    description: 'Identidad, autonomía, límites, emociones y vida escolar durante la adolescencia.'
  },
  psicologia: {
    slug: 'psicologia',
    label: 'Psicología',
    description: 'Divulgación sobre emociones, motivación, agotamiento y autoestima. No sustituye una valoración profesional ni constituye diagnóstico médico.'
  },
  pedagogia: {
    slug: 'pedagogia',
    label: 'Pedagogía',
    description: 'Educación humanizada, acompañamiento, motivación y la relación entre docentes y estudiantes.'
  },
  familia: {
    slug: 'familia',
    label: 'Familia',
    description: 'Vínculos, comunicación y convivencia entre adultos y adolescentes.'
  },
  tecnologia: {
    slug: 'tecnologia',
    label: 'Tecnología',
    description: 'La relación entre adolescentes, celulares, redes sociales y pantallas.'
  }
};

/* ==========================================================================
   ARTÍCULOS (contenido de demostración)
   ========================================================================== */
const ARTICLES = [
  {
    id: 1,
    title: '¿Por qué mi hijo adolescente parece no tener ganas de hacer nada?',
    slug: 'por-que-mi-hijo-adolescente-no-tiene-ganas-de-hacer-nada',
    category: 'psicologia',
    excerpt: 'Detrás de la apatía adolescente muchas veces hay cansancio acumulado, no falta de voluntad. Una mirada para comprender antes de juzgar.',
    date: '2026-06-02',
    featured: true,
    content: [
      { type: 'p', text: 'Cuando un adolescente pasa horas sin hacer "nada", solemos leerlo como desidia. Pero esa lectura suele dejar fuera una pregunta más honesta: ¿qué está cargando esa persona que no logramos ver?' },
      { type: 'h2', text: 'La apatía como síntoma, no como rasgo' },
      { type: 'p', text: 'La adolescencia combina cambios físicos, presión académica, exigencias sociales y una identidad en construcción. Cuando todo eso se acumula sin espacio de descarga, el cuerpo y la mente responden bajando el ritmo.' },
      { type: 'quote', text: 'No es pereza: es una forma de protegerse cuando ya no queda energía disponible.' },
      { type: 'h2', text: 'Qué podemos hacer los adultos' },
      { type: 'p', text: 'Antes de exigir motivación, vale la pena observar: ¿cómo está durmiendo?, ¿cuánta carga tiene esta semana?, ¿tiene tiempo para no hacer nada de forma sana? Comprender el contexto es el primer paso para acompañar sin presionar.' }
    ]
  },
  {
    id: 2,
    title: 'Celular y adolescentes: ¿cuándo debemos preocuparnos?',
    slug: 'celular-y-adolescentes-cuando-debemos-preocuparnos',
    category: 'tecnologia',
    excerpt: 'No todo uso intenso del celular es un problema. Estas son las señales que sí conviene observar con atención.',
    date: '2026-05-24',
    featured: true,
    content: [
      { type: 'p', text: 'El celular se ha convertido en el nuevo campo de batalla en muchas casas. Pero no toda pantalla encendida es un foco de alarma.' },
      { type: 'h2', text: 'Señales que merecen atención' },
      { type: 'p', text: 'Aislamiento progresivo, irritabilidad intensa al pedir que lo suelte, abandono de actividades que antes disfrutaba o alteraciones importantes del sueño son señales que conviene observar con más cuidado.' },
      { type: 'h2', text: 'Comprender antes de restringir' },
      { type: 'p', text: 'Poner límites sin entender qué función cumple el celular en la vida de un adolescente —conexión social, escape, pertenencia— suele generar más conflicto que soluciones.' }
    ]
  },
  {
    id: 3,
    title: 'No es pereza: entendiendo el agotamiento adolescente',
    slug: 'no-es-pereza-entendiendo-el-agotamiento-adolescente',
    category: 'psicologia',
    excerpt: 'El agotamiento adolescente se confunde con frecuencia con falta de disciplina. Una mirada distinta puede cambiar la relación.',
    date: '2026-05-10',
    featured: false,
    content: [
      { type: 'p', text: 'Cuando hablamos de agotamiento adolescente no nos referimos a un capricho pasajero, sino a una saturación real: académica, emocional y social.' },
      { type: 'h2', text: 'Un cansancio que no siempre se ve' },
      { type: 'p', text: 'A diferencia del cansancio físico, el agotamiento emocional puede disfrazarse de desinterés, irritabilidad o desconexión. Reconocerlo requiere mirar más allá de la conducta visible.' }
    ]
  },
  {
    id: 4,
    title: 'Cómo poner límites al celular sin convertir la casa en una batalla',
    slug: 'como-poner-limites-al-celular-sin-batalla',
    category: 'familia',
    excerpt: 'Poner límites no tiene por qué significar confrontación constante. Algunas claves para acordar en lugar de imponer.',
    date: '2026-04-28',
    featured: false,
    content: [
      { type: 'p', text: 'Los límites más sostenibles son los que se construyen en conjunto, no los que se imponen de un día para otro.' },
      { type: 'h2', text: 'De la orden al acuerdo' },
      { type: 'p', text: 'Explicar el porqué de un límite, involucrar al adolescente en su construcción y sostenerlo con consistencia —sin castigo humillante— cambia por completo la forma en que se recibe.' }
    ]
  },
  {
    id: 5,
    title: '¿Por qué los adolescentes necesitan tanto tiempo solos?',
    slug: 'por-que-los-adolescentes-necesitan-tiempo-solos',
    category: 'adolescencia',
    excerpt: 'El tiempo a solas cumple una función clave en la construcción de identidad adolescente. Aquí explicamos por qué.',
    date: '2026-04-15',
    featured: false,
    content: [
      { type: 'p', text: 'Encerrarse en su habitación no siempre es una señal de alarma: puede ser parte natural del proceso de individuación.' },
      { type: 'h2', text: 'Un espacio para procesar' },
      { type: 'p', text: 'El tiempo a solas permite a los adolescentes ordenar emociones, pensar sin supervisión y construir una identidad propia, distinta a la de la infancia.' }
    ]
  },
  {
    id: 6,
    title: 'Cuando estudiar se convierte en agotamiento',
    slug: 'cuando-estudiar-se-convierte-en-agotamiento',
    category: 'pedagogia',
    excerpt: 'La sobrecarga académica puede transformar el aprendizaje en una fuente de desgaste. Cómo identificarlo desde la escuela y la casa.',
    date: '2026-03-30',
    featured: false,
    content: [
      { type: 'p', text: 'Cuando la exigencia académica supera la capacidad real de sostenerla, el aprendizaje deja de ser motivador y se convierte en una fuente de estrés crónico.' },
      { type: 'h2', text: 'Repensar el ritmo, no solo el esfuerzo' },
      { type: 'p', text: 'Una educación humanizada no renuncia a la exigencia, pero sí revisa el ritmo, la carga y el acompañamiento con el que se sostiene.' }
    ]
  }
];

/* ==========================================================================
   GUÍAS DESCARGABLES (contenido de demostración)
   ========================================================================== */
const GUIDES = [
  {
    id: 1,
    title: '7 señales de que el celular de tu hijo ya no es solo un pasatiempo',
    slug: '7-senales-celular-pasatiempo',
    description: 'Una guía práctica para padres que quieren comprender cuándo el uso del celular puede estar comenzando a afectar la vida cotidiana de sus hijos.',
    category: 'tecnologia',
    format: 'PDF',
    downloadUrl: 'assets/descargas/guias-pdf/7-senales-celular-pasatiempo.pdf',
    free: true,
    featured: true
  },
  {
    id: 2,
    title: 'Cómo poner límites al celular sin convertirlo en una batalla',
    slug: 'limites-celular-sin-batalla',
    description: 'Estrategias concretas para acordar límites de pantalla desde el diálogo y no desde la imposición.',
    category: 'tecnologia',
    format: 'PDF',
    downloadUrl: '',
    free: false,
    featured: true
  },
  {
    id: 3,
    title: 'Cómo hablar con un adolescente sin terminar discutiendo',
    slug: 'hablar-con-adolescente-sin-discutir',
    description: 'Herramientas de comunicación para sostener conversaciones difíciles sin que se conviertan en conflicto.',
    category: 'familia',
    format: 'PDF',
    downloadUrl: '',
    free: false,
    featured: true
  },
  {
    id: 4,
    title: 'Adolescencia y agotamiento: qué podemos hacer como padres',
    slug: 'adolescencia-agotamiento-que-hacer',
    description: 'Una guía para reconocer el agotamiento adolescente y acompañarlo desde la comprensión, no desde la exigencia.',
    category: 'psicologia',
    format: 'PDF',
    downloadUrl: '',
    free: false,
    featured: false
  },
  {
    id: 5,
    title: 'Cuando mi hijo no quiere hacer nada',
    slug: 'cuando-mi-hijo-no-quiere-hacer-nada',
    description: 'Claves para diferenciar la apatía pasajera del agotamiento real, y cómo responder en cada caso.',
    category: 'psicologia',
    format: 'PDF',
    downloadUrl: '',
    free: false,
    featured: false
  }
];

/* ==========================================================================
   LIBRO / PRODUCTOS
   ========================================================================== */
const BOOKS = [
  {
    id: 1,
    title: 'Tu hijo no es vago, está agotado',
    subtitle: 'Una mirada diferente sobre el agotamiento adolescente',
    description: 'Muchas conductas que interpretamos como pereza, desinterés o falta de voluntad pueden esconder cansancio, presión, saturación emocional o dificultades que necesitan ser comprendidas.',
    origin: 'Este libro nace de la experiencia, la educación y la necesidad de mirar al adolescente desde otra perspectiva.',
    cover: 'assets/imagenes/libro/portada.jpg',
    purchaseUrl: SITE_CONFIG.BOOK_PURCHASE_URL, // TODO: URL real de compra (Amazon u otra)
    featured: true
  }
];
