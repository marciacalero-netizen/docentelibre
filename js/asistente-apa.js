/**
 * DOCENTE LIBRE — Asistente de Tesis: generador de referencias APA 7 (español)
 * Sin dependencias. Devuelve HTML (con <em> para las cursivas) y texto plano.
 */

const APA = (() => {
  const TIPOS = {
    libro: {
      nombre: 'Libro',
      campos: [
        ['autores', 'Autores', 'area', 'Una persona por línea: Apellidos, Nombres. Para una institución, escriba solo su nombre.'],
        ['rol', 'Los autores figuran como', 'select', '', [['', 'Autores'], ['ed', 'Editores (Ed./Eds.)'], ['coord', 'Coordinadores (Coord./Coords.)']]],
        ['anio', 'Año', 'texto', 'Déjelo vacío si la obra no tiene fecha.'],
        ['titulo', 'Título del libro', 'texto'],
        ['edicion', 'Edición', 'texto', 'Solo el número, desde la segunda (por ejemplo: 3).'],
        ['editorial', 'Editorial', 'texto'],
        ['doi', 'DOI o URL', 'texto', 'Opcional.'],
      ],
    },
    capitulo: {
      nombre: 'Capítulo de libro',
      campos: [
        ['autores', 'Autores del capítulo', 'area', 'Una persona por línea: Apellidos, Nombres.'],
        ['anio', 'Año', 'texto'],
        ['titulo', 'Título del capítulo', 'texto'],
        ['editores', 'Editores del libro', 'area', 'Una persona por línea: Apellidos, Nombres.'],
        ['libro', 'Título del libro', 'texto'],
        ['edicion', 'Edición', 'texto', 'Solo el número, desde la segunda.'],
        ['paginas', 'Páginas del capítulo', 'texto', 'Por ejemplo: 45-67'],
        ['editorial', 'Editorial', 'texto'],
        ['doi', 'DOI o URL', 'texto', 'Opcional.'],
      ],
    },
    articulo: {
      nombre: 'Artículo de revista',
      campos: [
        ['autores', 'Autores', 'area', 'Una persona por línea: Apellidos, Nombres.'],
        ['anio', 'Año', 'texto'],
        ['titulo', 'Título del artículo', 'texto'],
        ['revista', 'Nombre de la revista', 'texto'],
        ['volumen', 'Volumen', 'texto'],
        ['numero', 'Número', 'texto'],
        ['paginas', 'Páginas o número de artículo', 'texto', 'Por ejemplo: 123-145, o Artículo e0245'],
        ['doi', 'DOI o URL', 'texto'],
      ],
    },
    web: {
      nombre: 'Página web',
      campos: [
        ['autores', 'Autor o institución', 'area', 'Persona: Apellidos, Nombres. Institución: solo su nombre. Vacío si no hay autor.'],
        ['anio', 'Año', 'texto'],
        ['dia', 'Día y mes', 'texto', 'Opcional. Por ejemplo: 15 de marzo'],
        ['titulo', 'Título de la página', 'texto'],
        ['sitio', 'Nombre del sitio web', 'texto', 'Se omite si coincide con el autor.'],
        ['url', 'URL', 'texto'],
      ],
    },
    tesis: {
      nombre: 'Tesis o trabajo de grado',
      campos: [
        ['autores', 'Autor', 'area', 'Apellidos, Nombres.'],
        ['anio', 'Año', 'texto'],
        ['titulo', 'Título de la tesis', 'texto'],
        ['grado', 'Tipo', 'select', '', [['Tesis de licenciatura', 'Tesis de licenciatura'], ['Tesis de maestría', 'Tesis de maestría'], ['Tesis doctoral', 'Tesis doctoral'], ['Trabajo de grado', 'Trabajo de grado']]],
        ['universidad', 'Universidad', 'texto'],
        ['repositorio', 'Repositorio o base de datos', 'texto', 'Déjelo vacío si la tesis no está publicada.'],
        ['url', 'URL', 'texto', 'Opcional.'],
      ],
    },
    informe: {
      nombre: 'Informe o documento institucional',
      campos: [
        ['autores', 'Autor o institución', 'area', 'Institución: solo su nombre. Persona: Apellidos, Nombres.'],
        ['anio', 'Año', 'texto'],
        ['titulo', 'Título del informe', 'texto'],
        ['numero', 'Número de informe', 'texto', 'Opcional. Por ejemplo: Informe n.º 12'],
        ['editorial', 'Organismo que lo publica', 'texto', 'Se omite si coincide con el autor.'],
        ['url', 'URL', 'texto', 'Opcional.'],
      ],
    },
  };

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const limpio = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
  const sinPunto = (s) => limpio(s).replace(/\.+$/, '');
  const aTexto = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent;
  };
  // Añade punto final salvo que el texto visible ya termine en . ? o !
  const conPunto = (html) => (/[.?!]$/.test(html.replace(/<[^>]+>/g, '').trim()) ? html : `${html}.`);

  /* ---- Autores ---- */

  function parseAutores(texto) {
    return String(texto ?? '')
      .split(/\n|;/)
      .map(limpio)
      .filter(Boolean)
      .map((linea) => {
        const i = linea.indexOf(',');
        if (i === -1) return { corporativo: sinPunto(linea) };
        return { apellido: limpio(linea.slice(0, i)), nombres: limpio(linea.slice(i + 1)) };
      });
  }

  const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von', 'di']);

  function iniciales(nombres) {
    return limpio(nombres)
      .split(' ')
      .filter(Boolean)
      .map((parte) => {
        if (PARTICULAS.has(parte.toLowerCase())) return parte.toLowerCase();
        return parte
          .split('-')
          .filter(Boolean)
          .map((p) => `${p[0].toUpperCase()}.`)
          .join('-');
      })
      .join(' ');
  }

  const nombreRef = (a) => (a.corporativo ? a.corporativo : a.nombres ? `${a.apellido}, ${iniciales(a.nombres)}` : a.apellido);
  const nombreCita = (a) => a.corporativo || a.apellido;
  const nombreEditor = (a) => (a.corporativo ? a.corporativo : a.nombres ? `${iniciales(a.nombres)} ${a.apellido}` : a.apellido);

  function autoresRef(lista) {
    const n = lista.map(nombreRef);
    if (n.length <= 1) return n[0] || '';
    if (n.length === 2) return `${n[0]}, y ${n[1]}`;
    if (n.length <= 20) return `${n.slice(0, -1).join(', ')}, y ${n[n.length - 1]}`;
    return `${n.slice(0, 19).join(', ')}, . . . ${n[n.length - 1]}`;
  }

  function autoresCita(lista) {
    const n = lista.map(nombreCita);
    if (n.length === 1) return n[0];
    if (n.length === 2) return `${n[0]} y ${n[1]}`;
    return `${n[0]} et al.`;
  }

  function editoresRef(lista) {
    const n = lista.map(nombreEditor);
    if (n.length <= 1) return n[0] || '';
    if (n.length === 2) return `${n[0]} y ${n[1]}`;
    return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
  }

  /* ---- Elementos ---- */

  function enlace(valor) {
    let v = limpio(valor);
    if (!v) return '';
    if (/^doi:\s*/i.test(v)) v = v.replace(/^doi:\s*/i, '');
    if (/^10\.\d{4,}\//.test(v)) v = `https://doi.org/${v}`;
    v = v.replace(/^https?:\/\/(dx\.)?doi\.org\//i, 'https://doi.org/');
    return esc(v);
  }

  const edicion = (valor) => {
    const v = limpio(valor);
    if (!v) return '';
    return /^\d+$/.test(v) ? `${v}.ª ed.` : esc(sinPunto(v));
  };

  const paginas = (valor) => esc(limpio(valor).replace(/\s*[-–—]\s*/g, '-'));

  /* ---- Construcción ---- */

  function generar(tipo, d) {
    const autores = parseAutores(d.autores);
    const anio = limpio(d.anio) || 's. f.';
    let fecha = esc(anio);
    if (tipo === 'web' && limpio(d.dia) && anio !== 's. f.') fecha = `${esc(anio)}, ${esc(limpio(d.dia))}`;

    let autor = esc(autoresRef(autores));
    let titulo = ''; // elemento título, con sus aclaraciones
    let tituloCita = ''; // cómo se cita la obra cuando no tiene autor
    const resto = []; // elementos de fuente, cada uno ya con su puntuación

    const t = esc(sinPunto(d.titulo));
    const autorTexto = autoresRef(autores).toLowerCase();

    switch (tipo) {
      case 'libro': {
        if (autores.length && d.rol) {
          const plural = autores.length > 1;
          const sigla = d.rol === 'ed' ? (plural ? 'Eds.' : 'Ed.') : plural ? 'Coords.' : 'Coord.';
          autor = `${conPunto(autor)} (${sigla})`;
        }
        const ed = edicion(d.edicion);
        titulo = `<em>${t}</em>${ed ? ` (${ed})` : ''}`;
        tituloCita = `<em>${t}</em>`;
        if (limpio(d.editorial)) resto.push(conPunto(esc(sinPunto(d.editorial))));
        if (enlace(d.doi)) resto.push(enlace(d.doi));
        break;
      }
      case 'capitulo': {
        titulo = t;
        tituloCita = `«${t}»`;
        const eds = parseAutores(d.editores);
        const ed = edicion(d.edicion);
        const pp = limpio(d.paginas) ? `${/[-–—]/.test(d.paginas) ? 'pp.' : 'p.'} ${paginas(d.paginas)}` : '';
        const aclaracion = [ed, pp].filter(Boolean).join(', ');
        let en = 'En ';
        if (eds.length) en += `${esc(editoresRef(eds))} (${eds.length > 1 ? 'Eds.' : 'Ed.'}), `;
        en += `<em>${esc(sinPunto(d.libro))}</em>${aclaracion ? ` (${aclaracion})` : ''}`;
        resto.push(conPunto(en));
        if (limpio(d.editorial)) resto.push(conPunto(esc(sinPunto(d.editorial))));
        if (enlace(d.doi)) resto.push(enlace(d.doi));
        break;
      }
      case 'articulo': {
        titulo = t;
        tituloCita = `«${t}»`;
        let fuente = `<em>${esc(sinPunto(d.revista))}</em>`;
        if (limpio(d.volumen)) fuente += `, <em>${esc(limpio(d.volumen))}</em>`;
        if (limpio(d.numero)) fuente += `${limpio(d.volumen) ? '' : ', '}(${esc(limpio(d.numero))})`;
        if (limpio(d.paginas)) fuente += `, ${paginas(d.paginas)}`;
        if (limpio(d.revista)) resto.push(conPunto(fuente));
        if (enlace(d.doi)) resto.push(enlace(d.doi));
        break;
      }
      case 'web': {
        titulo = `<em>${t}</em>`;
        tituloCita = `<em>${t}</em>`;
        const sitio = sinPunto(d.sitio);
        if (sitio && sitio.toLowerCase() !== autorTexto) resto.push(conPunto(esc(sitio)));
        if (enlace(d.url)) resto.push(enlace(d.url));
        break;
      }
      case 'tesis': {
        const grado = esc(limpio(d.grado) || 'Tesis');
        const uni = esc(sinPunto(d.universidad));
        const repo = sinPunto(d.repositorio);
        tituloCita = `<em>${t}</em>`;
        if (repo || limpio(d.url)) {
          titulo = `<em>${t}</em> [${grado}${uni ? `, ${uni}` : ''}]`;
          if (repo) resto.push(conPunto(esc(repo)));
          if (enlace(d.url)) resto.push(enlace(d.url));
        } else {
          const genero = /^tesis/i.test(limpio(d.grado) || 'Tesis') ? 'no publicada' : 'no publicado';
          titulo = `<em>${t}</em> [${grado} ${genero}]`;
          if (uni) resto.push(conPunto(uni));
        }
        break;
      }
      case 'informe': {
        const num = sinPunto(d.numero);
        titulo = `<em>${t}</em>${num ? ` (${esc(num)})` : ''}`;
        tituloCita = `<em>${t}</em>`;
        const org = sinPunto(d.editorial);
        if (org && org.toLowerCase() !== autorTexto) resto.push(conPunto(esc(org)));
        if (enlace(d.url)) resto.push(enlace(d.url));
        break;
      }
      default:
        return null;
    }

    const cola = resto.length ? ` ${resto.join(' ')}` : '';
    const html = autor
      ? `${conPunto(autor)} (${fecha}). ${conPunto(titulo)}${cola}`
      : `${conPunto(titulo)} (${fecha}).${cola}`;

    const quien = autores.length ? esc(autoresCita(autores)) : tituloCita;
    const anioCita = esc(anio);
    return {
      html,
      texto: aTexto(html),
      parentetica: `(${quien}, ${anioCita})`,
      narrativa: `${quien} (${anioCita})`,
      textual: `(${quien}, ${anioCita}, p. xx)`,
      orden: aTexto(html).toLowerCase(),
    };
  }

  function faltantes(tipo, d) {
    const obligatorios = {
      libro: ['titulo', 'editorial'],
      capitulo: ['titulo', 'libro', 'editorial'],
      articulo: ['titulo', 'revista'],
      web: ['titulo', 'url'],
      tesis: ['titulo', 'universidad'],
      informe: ['titulo'],
    }[tipo] || [];
    const etiquetas = Object.fromEntries(TIPOS[tipo].campos.map((c) => [c[0], c[1]]));
    return obligatorios.filter((c) => !limpio(d[c])).map((c) => etiquetas[c]);
  }

  return { TIPOS, generar, faltantes, aTexto, esc };
})();
