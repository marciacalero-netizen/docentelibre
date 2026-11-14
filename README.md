# Docente Libre

Sitio web de **Docente Libre**, marca personal y espacio de divulgación
educativa sobre adolescencia, psicología, pedagogía, familia y tecnología.
No es una biblioteca de planificaciones ni de materiales escolares.

Sitio estático (HTML + CSS + JS, sin build ni frameworks) para poder
publicarse en cualquier hosting y migrar a WordPress u otro backend más
adelante sin rehacer el diseño.

## Cómo verlo en local

No requiere instalación. Basta con servir la carpeta con cualquier servidor
estático, por ejemplo:

```bash
python3 -m http.server 8000
```

y abrir `http://localhost:8000/index.html`.

## Estructura

```
index.html          Página de inicio (landing completa)
sobre-mi.html        Biografía de Marcia
libro.html            Página del libro "Tu hijo no es vago, está agotado"
guias.html            Guía gratuita (formulario) + listado completo de guías
articulos.html        Índice del blog, con filtro por categoría
articulo.html         Plantilla de artículo individual (?slug=...)
adolescencia.html     Categoría: Adolescencia
psicologia.html       Categoría: Psicología
pedagogia.html        Categoría: Pedagogía
categoria.html         Categoría genérica (?cat=familia | ?cat=tecnologia)
contacto.html          Formulario de contacto
privacidad.html, terminos.html, cookies.html   Páginas legales (en preparación)

css/styles.css        Sistema de diseño (tokens, tipografía, componentes)
js/data.js             Capa de contenido: artículos, guías, libro y configuración
js/main.js              Comportamiento: navegación, formularios, animaciones,
                         renderizado de tarjetas de artículos/guías
```

## Contenido y crecimiento

Todo el contenido editorial (artículos, guías, libro) vive en `js/data.js`,
separado del HTML. Añadir un artículo o una guía nueva es agregar un objeto
al array correspondiente — no requiere tocar el diseño. Los artículos son
contenido de demostración, listos para sustituirse por contenido real.

## Pendiente de conectar (a propósito, no simulado)

Estas piezas están preparadas en el código pero deliberadamente **no**
simuladas, siguiendo el criterio de no inventar fotos, descargas ni enlaces:

- **Fotografía de Marcia** y **portada real del libro** → marcadores de
  posición elegantes en `index.html`, `sobre-mi.html` y `libro.html`.
- **`SITE_CONFIG.FREE_GUIDE_URL`** (`js/data.js`) → URL real del PDF de la
  guía gratuita. Hasta entonces, el formulario valida y confirma el registro
  pero no ofrece una descarga.
- **`SITE_CONFIG.FORM_ENDPOINT`** → integración futura con Brevo, Mailchimp,
  Google Forms, Formspree o backend propio para los tres formularios (guía
  gratuita, newsletter, contacto).
- **`SITE_CONFIG.BOOK_PURCHASE_URL`** → enlace real de compra (Amazon u otra
  plataforma) para el botón "Comprar el libro".
- **Redes sociales** → hoy son etiquetas de texto en el footer; sustituir por
  enlaces reales cuando existan los perfiles.

## SEO

Cada página tiene `<title>`, meta description, Open Graph y URL canónica
propios. La plantilla de artículo (`articulo.html`) genera además su título,
meta description y datos estructurados (`schema.org/Article`) dinámicamente
según el artículo cargado. Incluye `robots.txt` y `sitemap.xml` básicos.

## Asistente de tesis (privado)

`asistente-tesis.html` es una herramienta privada para la tutoría de tesis de
pregrado, maestría y doctorado. No está enlazada en el menú ni se indexa.

- **Tesistas**: seguimiento por capítulos, fechas, avance y bitácora de asesorías.
- **Citas APA 7**: generador de referencias y citas, lista exportable a Word.
- **Estructura y formato**: guía por nivel, formato APA 7 y lista de verificación.
- **Revisión con IA** y **Chat**: usan la API de Anthropic (Claude) a través del
  Worker `worker/index.js` (rutas `/api/auth` y `/api/chat`).

Los datos de las tesis se guardan solo en el navegador (localStorage); la
pestaña Tesistas permite descargar y restaurar un respaldo.

### Configuración en Cloudflare

El Worker necesita dos secretos (Workers & Pages → docentelibre → Settings →
Variables and Secrets → Add → tipo *Secret*):

| Nombre | Valor |
| --- | --- |
| `ANTHROPIC_API_KEY` | Clave creada en https://console.anthropic.com (API keys) |
| `ASISTENTE_PASSWORD` | Contraseña larga de acceso al asistente |

Nunca se escriben en el código ni en el repositorio.

### Archivos

```
asistente-tesis.html      Página del asistente
css/asistente.css         Estilos propios (usa los tokens de styles.css)
js/asistente-datos.js     Estructuras por nivel, guía APA y lista de verificación
js/asistente-apa.js       Generador de referencias APA 7
js/asistente.js           Interfaz y almacenamiento local
worker/index.js           Worker: contraseña y conexión con Claude
worker/prompts.js         Instrucciones del asistente de IA
```

Para adaptar la estructura al reglamento de una universidad, edite
`js/asistente-datos.js`. Para probar en local: `npm install`, crear `.dev.vars`
con los dos secretos y ejecutar `npm run dev`.
