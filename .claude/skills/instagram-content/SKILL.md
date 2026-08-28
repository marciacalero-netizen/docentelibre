---
name: instagram-content
description: Convierte artículos del blog de Docente Libre (o cualquier tema dentro de sus ejes editoriales) en contenido listo para Instagram — posts únicos, carruseles, guiones de reel e historias — manteniendo la voz de marca "educación humanizada" de Marcia. Usa este skill cada vez que se pida crear, planear o redactar contenido para Instagram, redes sociales, carrusel, reel, caption o calendario de publicaciones para Docente Libre, incluso si no se menciona la palabra "skill" explícitamente — por ejemplo "convierte este artículo en un carrusel", "dame 3 ideas de reel sobre el agotamiento adolescente" o "necesito el caption para el post de esta semana".
---

# Contenido para Instagram — Docente Libre

Este skill traduce las reflexiones de Docente Libre (blog sobre adolescencia,
psicología, pedagogía, familia y tecnología) al lenguaje de Instagram, sin
perder lo que hace reconocible a la marca: mirar antes de juzgar, y acompañar
en lugar de sermonear.

Antes de escribir nada, lee **`references/voz-de-marca.md`**. Es corto pero
es lo que evita que el contenido suene genérico — ahí están el tono, las
frases que Marcia sí usaría, las que no, la paleta de marca y los CTA
disponibles.

## De dónde sale el contenido

1. **Si el usuario da un artículo, slug o tema del blog** — búscalo en
   `js/data.js` (array `ARTICLES`). Ahí está el título, la categoría, el
   excerpt y el cuerpo real. Usa ese texto como fuente: no inventes datos,
   estadísticas ni citas que no estén respaldados por él. Muchos artículos
   son breves (2-4 bloques), y eso no alcanza para llenar un carrusel de
   10 slides o un reel completo sin sonar repetitivo o quedarse corto. En
   ese caso, tienes permiso de **ampliar con reflexión propia** que
   desarrolle la misma idea del artículo — ejemplos concretos, preguntas
   que interpelen, matices — siempre que sea coherente con el giro y el
   tono de `voz-de-marca.md` y no contradiga ni tergiverse lo que dice el
   artículo. La regla no es "cero palabras nuevas", es "cero datos o
   afirmaciones inventadas que se le atribuyan al artículo o a Marcia".
2. **Si el usuario da un tema libre** ("algo sobre el celular y las peleas
   en casa") sin artículo asociado — puedes proponer contenido original,
   pero mantente dentro de los cinco ejes editoriales (adolescencia,
   psicología, pedagogía, familia, tecnología) y del mismo cuidado: esto es
   divulgación, no diagnóstico clínico ni consejo médico. Cuando el tema
   roce psicología, evita frases que suenen a diagnóstico ("tu hijo tiene
   ansiedad") — usa el registro de observación que ya usa el sitio ("puede
   estar mostrando señales de...").
3. **Si el usuario pega texto directamente** (un borrador, una idea suelta)
   — trabaja con eso como fuente principal.

Nunca inventes enlaces de Instagram, @handles, ni cifras de engagement: el
`SITE_CONFIG.social` del sitio todavía está vacío (no hay perfil real
conectado), así que el contenido debe funcionar sin depender de un link en
bio específico salvo que el usuario lo indique.

## Qué formatos puede pedir el usuario

Lee **`references/formatos.md`** para la plantilla y las convenciones de
cada uno. En resumen:

| Formato | Cuándo usarlo |
|---|---|
| **Post único** (imagen + caption) | Una idea concentrada, cita o reflexión corta |
| **Carrusel** (5–10 slides) | Desglosar un artículo o explicar un "cómo" paso a paso |
| **Guion de reel** | Ideas que funcionan mejor habladas/con gancho visual |
| **Historias** | Encuestas, preguntas, o teasers de un post/carrusel/reel |

Si el usuario no especifica el formato, pregunta cuál prefiere o —si el
pedido ya sugiere uno claramente ("dame el carrusel de...")— úsalo
directamente sin pedir confirmación.

## Cómo entregar el resultado

Siempre en **texto editable** (Markdown en la respuesta o en un archivo si
el usuario pide guardar varias piezas), nunca como imagen renderizada por
defecto — Marcia arma el diseño visual aparte (Canva u otra herramienta) y
necesita poder copiar y ajustar el texto. Si el usuario pide explícitamente
que además generes el diseño visual (por ejemplo, tiene conectado Canva o
higgsfield en la sesión), puedes ofrecerlo, pero el texto sigue siendo el
entregable principal y debe funcionar por sí solo.

Cada pieza de contenido debe incluir, en este orden:
1. **Formato y fuente** (de qué artículo o tema sale, una línea).
2. **El contenido en sí** (siguiendo la plantilla de `formatos.md`).
3. **Caption completo** (si el formato no es ya el caption) con line breaks
   pensados para Instagram (párrafos cortos, no un bloque de texto).
4. **Hashtags**: 8–15, mezclando de marca/nicho (p. ej. #educacionhumanizada,
   #adolescencia, #crianzaconsciente) con algunos de alcance medio — nunca
   hashtags genéricos masivos tipo #love #instagood que no aportan.
5. **CTA** (opcional, no en cada pieza): guía gratuita, el libro, o
   simplemente invitar al guardado/comentario. Ver la sección de CTAs en
   `voz-de-marca.md` — no todas las piezas necesitan vender algo; muchas
   funcionan mejor generando identificación y guardados.

## Al pedir varias piezas o un calendario

Si el usuario pide un lote (p. ej. "dame contenido para toda la semana" o
"un calendario del mes"), organiza por día/fecha y varía los formatos y las
categorías — no repitas el mismo eje editorial en publicaciones consecutivas
salvo que el usuario esté en campaña sobre un tema puntual (p. ej. lanzamiento
del libro o de la guía gratuita).

## Errores comunes a evitar

- Sonar como una cuenta genérica de "tips para padres" — la voz de Docente
  Libre es de comprensión, no de recetas fáciles ni de alarmismo.
- Usar exceso de emojis o mayúsculas — el sitio es cálido pero sobrio.
- Prometer resultados clínicos o diagnosticar a través de un post.
- Convertir cada pieza en una venta del libro o la guía — eso cansa a la
  audiencia y no es el tono del sitio.
