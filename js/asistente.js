/**
 * DOCENTE LIBRE — Asistente de Tesis (interfaz)
 * Los datos de las tesis se guardan solo en este navegador (localStorage).
 * El chat y la revisión con IA pasan por /api/chat (Worker de Cloudflare).
 */

(() => {
  const CLAVE_DATOS = 'dl_asistente_tesis_v1';
  const CLAVE_ACCESO = 'dl_asistente_acceso';
  const esc = APA.esc;
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const hoy = () => new Date().toISOString().slice(0, 10);

  /* ==================== Estado ==================== */

  let estado = { tesis: [], activa: null, sueltas: [] };
  let clave = '';
  let chat = []; // conversación en memoria
  let ocupado = false;
  let refEditando = null;
  let ultimaRevision = '';

  function cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_DATOS));
      if (guardado && Array.isArray(guardado.tesis)) estado = { sueltas: [], ...guardado };
    } catch { /* datos ilegibles: se empieza de cero */ }
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE_DATOS, JSON.stringify(estado));
    } catch {
      aviso('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).');
    }
  }

  const tesisActiva = () => estado.tesis.find((t) => t.id === estado.activa) || null;
  const referencias = () => (tesisActiva() ? tesisActiva().referencias : estado.sueltas);

  function nuevaTesis(datos) {
    return {
      id: uid(),
      estudiante: datos.estudiante || '',
      titulo: datos.titulo || '',
      nivel: datos.nivel || 'pregrado',
      programa: '',
      universidad: '',
      inicio: hoy(),
      entrega: '',
      notas: '',
      capitulos: ESTRUCTURAS[datos.nivel || 'pregrado'].map((c) => ({
        id: uid(), nombre: c.nombre, estado: 'pendiente', fecha: '', nota: '',
      })),
      referencias: [],
      bitacora: [],
      checklist: {},
    };
  }

  function avance(t) {
    if (!t.capitulos.length) return 0;
    const pesos = Object.fromEntries(ESTADOS.map((e) => [e.id, e.peso]));
    const suma = t.capitulos.reduce((s, c) => s + (pesos[c.estado] ?? 0), 0);
    return Math.round((suma / t.capitulos.length) * 100);
  }

  function diasPara(fecha) {
    if (!fecha) return null;
    const d = new Date(`${fecha}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const base = new Date(`${hoy()}T00:00:00`);
    return Math.round((d - base) / 86400000);
  }

  function textoPlazo(fecha) {
    const dias = diasPara(fecha);
    if (dias === null) return '';
    if (dias < 0) return `Venció hace ${-dias} día${dias === -1 ? '' : 's'}`;
    if (dias === 0) return 'Vence hoy';
    return `Faltan ${dias} día${dias === 1 ? '' : 's'}`;
  }

  const fechaLegible = (iso) => {
    if (!iso) return '';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  };

  /* ==================== Utilidades de interfaz ==================== */

  let temporizadorAviso;
  function aviso(texto) {
    const el = $('#aviso');
    el.textContent = texto;
    el.classList.add('is-visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  async function copiar(html, texto) {
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([texto], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(texto);
      }
      aviso('Copiado al portapapeles.');
    } catch {
      aviso('No se pudo copiar. Seleccione el texto y cópielo manualmente.');
    }
  }

  function descargar(nombre, contenido, tipo) {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Markdown mínimo y seguro: se escapa todo y luego se aplican las marcas.
  function markdown(texto) {
    const enLinea = (s) =>
      esc(s)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    const salida = [];
    let lista = null;
    let parrafo = [];
    const cerrarParrafo = () => {
      if (parrafo.length) salida.push(`<p>${parrafo.join('<br>')}</p>`);
      parrafo = [];
    };
    const cerrarLista = () => {
      if (lista) salida.push(`</${lista}>`);
      lista = null;
    };
    for (const linea of String(texto).split('\n')) {
      const l = linea.trimEnd();
      let m;
      if (!l.trim()) {
        cerrarParrafo();
        cerrarLista();
      } else if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
        cerrarParrafo();
        cerrarLista();
        const n = Math.min(m[1].length + 2, 5);
        salida.push(`<h${n}>${enLinea(m[2])}</h${n}>`);
      } else if ((m = l.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/))) {
        cerrarParrafo();
        const tipo = /\d/.test(m[1]) ? 'ol' : 'ul';
        if (lista !== tipo) {
          cerrarLista();
          salida.push(`<${tipo}>`);
          lista = tipo;
        }
        salida.push(`<li>${enLinea(m[2])}</li>`);
      } else if ((m = l.match(/^>\s?(.*)$/))) {
        cerrarParrafo();
        cerrarLista();
        salida.push(`<blockquote>${enLinea(m[1])}</blockquote>`);
      } else if (/^-{3,}$/.test(l.trim())) {
        cerrarParrafo();
        cerrarLista();
        salida.push('<hr>');
      } else {
        cerrarLista();
        parrafo.push(enLinea(l));
      }
    }
    cerrarParrafo();
    cerrarLista();
    return salida.join('');
  }

  /* ==================== Acceso ==================== */

  async function api(ruta, cuerpo) {
    return fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
      body: JSON.stringify(cuerpo ?? {}),
    });
  }

  async function entrar(valor, recordar) {
    const error = $('#acceso-error');
    error.textContent = '';
    clave = valor;
    let respuesta;
    try {
      respuesta = await api('/api/auth');
    } catch {
      error.textContent = 'No se pudo conectar con el servidor. Compruebe su conexión.';
      return false;
    }
    if (respuesta.ok) {
      try {
        sessionStorage.setItem(CLAVE_ACCESO, valor);
        if (recordar) localStorage.setItem(CLAVE_ACCESO, valor);
      } catch { /* sin almacenamiento: la sesión dura hasta cerrar la pestaña */ }
      mostrarApp();
      return true;
    }
    clave = '';
    let mensaje = 'No se pudo comprobar la contraseña.';
    try {
      mensaje = (await respuesta.json()).error || mensaje;
    } catch {
      if (respuesta.status === 404 || respuesta.status === 405) {
        mensaje = 'El servidor del asistente no está activo en este sitio. Revise el despliegue en Cloudflare.';
      }
    }
    error.textContent = mensaje;
    return false;
  }

  function salir() {
    clave = '';
    try {
      sessionStorage.removeItem(CLAVE_ACCESO);
      localStorage.removeItem(CLAVE_ACCESO);
    } catch { /* nada que borrar */ }
    $('#app').hidden = true;
    $('#acceso').hidden = false;
    $('#btn-salir').hidden = true;
    $('#acceso-clave').value = '';
    $('#acceso-clave').focus();
  }

  function mostrarApp() {
    $('#acceso').hidden = true;
    $('#app').hidden = false;
    $('#btn-salir').hidden = false;
    pintarTodo();
  }

  /* ==================== Pestañas ==================== */

  function abrirPestana(id) {
    $$('.at-tab').forEach((b) => {
      const activa = b.dataset.tab === id;
      b.classList.toggle('is-active', activa);
      b.setAttribute('aria-selected', String(activa));
    });
    $$('.at-panel').forEach((p) => (p.hidden = p.id !== `panel-${id}`));
  }

  /* ==================== Tesis y seguimiento ==================== */

  function pintarSelector() {
    const t = tesisActiva();
    $$('.at-activa').forEach((el) => {
      el.innerHTML = t
        ? `Tesis activa: <strong>${esc(t.estudiante || 'Sin nombre')}</strong>${t.titulo ? ` — ${esc(t.titulo)}` : ''}`
        : 'No hay una tesis seleccionada. Lo que guarde quedará en la lista general.';
    });
  }

  function pintarLista() {
    const cont = $('#lista-tesis');
    if (!estado.tesis.length) {
      cont.innerHTML = '<p class="at-vacio">Todavía no hay tesis registradas. Cree la primera con el formulario.</p>';
      return;
    }
    cont.innerHTML = estado.tesis
      .map((t) => {
        const p = avance(t);
        const plazo = textoPlazo(t.entrega);
        const vencida = diasPara(t.entrega) !== null && diasPara(t.entrega) < 0 && p < 100;
        return `
        <button type="button" class="at-tesis-card${t.id === estado.activa ? ' is-active' : ''}" data-abrir="${t.id}">
          <span class="at-tesis-nivel">${esc(NIVELES[t.nivel] || '')}</span>
          <strong>${esc(t.estudiante || 'Sin nombre')}</strong>
          <span class="at-tesis-titulo">${esc(t.titulo || 'Sin título')}</span>
          <span class="at-barra" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p}%"></span></span>
          <span class="at-tesis-meta"><span>${p}% de avance</span>${plazo ? `<span class="${vencida ? 'at-alerta' : ''}">${esc(plazo)}</span>` : ''}</span>
        </button>`;
      })
      .join('');
  }

  function pintarDetalle() {
    const cont = $('#detalle-tesis');
    const t = tesisActiva();
    if (!t) {
      cont.innerHTML = '<p class="at-vacio">Seleccione una tesis de la lista para ver su seguimiento.</p>';
      return;
    }
    const opcionesEstado = (actual) =>
      ESTADOS.map((e) => `<option value="${e.id}"${e.id === actual ? ' selected' : ''}>${e.nombre}</option>`).join('');
    const p = avance(t);

    cont.innerHTML = `
      <div class="at-detalle-cabecera">
        <div>
          <p class="eyebrow">Seguimiento</p>
          <h2>${esc(t.estudiante || 'Sin nombre')}</h2>
        </div>
        <div class="at-avance-num"><strong>${p}%</strong><span>avance</span></div>
      </div>
      <span class="at-barra at-barra-grande"><span style="width:${p}%"></span></span>

      <div class="at-grid-2" data-form-tesis>
        <div class="form-field"><label for="t-estudiante">Estudiante</label><input id="t-estudiante" data-campo="estudiante" value="${esc(t.estudiante)}"></div>
        <div class="form-field"><label for="t-nivel">Nivel</label>
          <select id="t-nivel" data-campo="nivel">${Object.entries(NIVELES).map(([k, v]) => `<option value="${k}"${k === t.nivel ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="form-field at-ancho"><label for="t-titulo">Título de la tesis</label><input id="t-titulo" data-campo="titulo" value="${esc(t.titulo)}"></div>
        <div class="form-field"><label for="t-programa">Programa</label><input id="t-programa" data-campo="programa" value="${esc(t.programa)}"></div>
        <div class="form-field"><label for="t-universidad">Universidad</label><input id="t-universidad" data-campo="universidad" value="${esc(t.universidad)}"></div>
        <div class="form-field"><label for="t-inicio">Fecha de inicio</label><input type="date" id="t-inicio" data-campo="inicio" value="${esc(t.inicio)}"></div>
        <div class="form-field"><label for="t-entrega">Fecha de entrega final</label><input type="date" id="t-entrega" data-campo="entrega" value="${esc(t.entrega)}"></div>
        <div class="form-field at-ancho"><label for="t-notas">Notas generales</label><textarea id="t-notas" data-campo="notas" rows="3">${esc(t.notas)}</textarea></div>
      </div>

      <h3>Capítulos y entregas</h3>
      <div class="at-capitulos">
        ${t.capitulos
          .map((c) => {
            const plazo = c.estado === 'aprobado' ? '' : textoPlazo(c.fecha);
            const vencido = plazo && diasPara(c.fecha) < 0;
            return `
          <div class="at-capitulo" data-cap="${c.id}">
            <div class="at-capitulo-fila">
              <input class="at-cap-nombre" data-cap-campo="nombre" value="${esc(c.nombre)}" aria-label="Nombre del capítulo">
              <select data-cap-campo="estado" class="at-estado at-estado-${c.estado}" aria-label="Estado">${opcionesEstado(c.estado)}</select>
              <input type="date" data-cap-campo="fecha" value="${esc(c.fecha)}" aria-label="Fecha límite">
              <button type="button" class="at-icono" data-quitar-cap="${c.id}" aria-label="Eliminar capítulo" title="Eliminar capítulo">×</button>
            </div>
            ${plazo ? `<p class="at-cap-plazo${vencido ? ' at-alerta' : ''}">${esc(plazo)}</p>` : ''}
            <textarea data-cap-campo="nota" rows="2" placeholder="Observaciones para este capítulo" aria-label="Observaciones">${esc(c.nota)}</textarea>
          </div>`;
          })
          .join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-accion="agregar-capitulo">Agregar capítulo</button>

      <h3>Bitácora de asesorías</h3>
      <form class="at-bitacora-form" data-form-bitacora>
        <input type="date" name="fecha" value="${hoy()}" aria-label="Fecha">
        <input name="texto" placeholder="Qué se revisó, acuerdos y tareas" aria-label="Anotación" required>
        <button type="submit" class="btn btn-primary btn-sm">Anotar</button>
      </form>
      <div class="at-bitacora">
        ${
          t.bitacora.length
            ? [...t.bitacora]
                .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                .map(
                  (b) => `
            <details class="at-entrada">
              <summary><span>${esc(fechaLegible(b.fecha))}</span> ${esc(b.titulo || b.texto.slice(0, 90))}</summary>
              <div class="at-prosa">${b.titulo ? markdown(b.texto) : `<p>${esc(b.texto)}</p>`}</div>
              <button type="button" class="btn btn-ghost btn-sm" data-quitar-bitacora="${b.id}">Eliminar anotación</button>
            </details>`
                )
                .join('')
            : '<p class="at-vacio">Sin anotaciones todavía.</p>'
        }
      </div>

      <div class="at-zona-peligro">
        <button type="button" class="btn btn-ghost btn-sm" data-accion="eliminar-tesis">Eliminar esta tesis</button>
      </div>`;
  }

  /* ==================== Citas APA ==================== */

  function pintarCamposCita(valores = {}) {
    const tipo = $('#cita-tipo').value;
    $('#cita-campos').innerHTML = APA.TIPOS[tipo].campos
      .map(([id, etiqueta, clase, ayuda, opciones]) => {
        const v = valores[id] ?? '';
        let control;
        if (clase === 'area') control = `<textarea id="c-${id}" name="${id}" rows="3">${esc(v)}</textarea>`;
        else if (clase === 'select')
          control = `<select id="c-${id}" name="${id}">${opciones.map(([val, txt]) => `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(txt)}</option>`).join('')}</select>`;
        else control = `<input id="c-${id}" name="${id}" value="${esc(v)}">`;
        return `<div class="form-field${clase === 'area' ? ' at-ancho' : ''}"><label for="c-${id}">${esc(etiqueta)}</label>${control}${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</div>`;
      })
      .join('');
    pintarVistaCita();
  }

  function datosCita() {
    const datos = {};
    $$('#cita-campos [name]').forEach((el) => (datos[el.name] = el.value));
    return datos;
  }

  function pintarVistaCita() {
    const tipo = $('#cita-tipo').value;
    const datos = datosCita();
    const vista = $('#cita-vista');
    const hayAlgo = Object.entries(datos).some(([k, v]) => !['rol', 'grado'].includes(k) && v.trim());
    if (!hayAlgo) {
      vista.innerHTML = '<p class="at-vacio">Complete los datos y la referencia aparecerá aquí.</p>';
      return;
    }
    const r = APA.generar(tipo, datos);
    const faltan = APA.faltantes(tipo, datos);
    vista.innerHTML = `
      <p class="at-etiqueta">Referencia</p>
      <p class="at-referencia">${r.html}</p>
      <div class="at-citas">
        <div><p class="at-etiqueta">Cita parentética</p><p>${r.parentetica}</p></div>
        <div><p class="at-etiqueta">Cita narrativa</p><p>${r.narrativa}</p></div>
        <div><p class="at-etiqueta">Cita textual</p><p>${r.textual}</p></div>
      </div>
      ${faltan.length ? `<p class="at-nota">Datos que faltan: ${esc(faltan.join(', '))}.</p>` : ''}`;
  }

  function referenciasOrdenadas() {
    return referencias()
      .map((r) => ({ ...r, apa: APA.generar(r.tipo, r.datos) }))
      .sort((a, b) => a.apa.orden.localeCompare(b.apa.orden, 'es'));
  }

  function pintarReferencias() {
    const lista = referenciasOrdenadas();
    $('#refs-total').textContent = lista.length ? `(${lista.length})` : '';
    $('#refs-lista').innerHTML = lista.length
      ? lista
          .map(
            (r) => `
        <li>
          <p class="at-referencia">${r.apa.html}</p>
          <p class="at-ref-acciones">
            <span>${r.apa.parentetica}</span>
            <button type="button" data-copiar-ref="${r.id}">Copiar</button>
            <button type="button" data-editar-ref="${r.id}">Editar</button>
            <button type="button" data-quitar-ref="${r.id}">Eliminar</button>
          </p>
        </li>`
          )
          .join('')
      : '<li class="at-vacio">Aún no hay referencias guardadas.</li>';
  }

  function listaComoHtml() {
    return referenciasOrdenadas()
      .map((r) => `<p style="margin:0 0 0 1.27cm;text-indent:-1.27cm;line-height:2">${r.apa.html}</p>`)
      .join('');
  }

  /* ==================== Guía ==================== */

  function pintarGuia() {
    const nivel = $('#guia-nivel').value;
    $('#guia-estructura').innerHTML = ESTRUCTURAS[nivel]
      .map(
        (c, i) => `
      <details${i === 1 ? ' open' : ''}>
        <summary>${esc(c.nombre)}</summary>
        <ul>${c.guia.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
      </details>`
      )
      .join('');
  }

  function pintarFormato() {
    $('#guia-formato').innerHTML = FORMATO_APA.map(
      (s, i) => `
      <details${i === 0 ? ' open' : ''}>
        <summary>${esc(s.titulo)}</summary>
        <ul>${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </details>`
    ).join('');
  }

  function pintarChecklist() {
    const t = tesisActiva();
    const marcas = t ? t.checklist : {};
    let total = 0;
    let hechos = 0;
    $('#checklist').innerHTML = CHECKLIST_REVISION.map(
      (g, gi) => `
      <fieldset>
        <legend>${esc(g.grupo)}</legend>
        ${g.items
          .map((item, ii) => {
            const id = `${gi}-${ii}`;
            total += 1;
            if (marcas[id]) hechos += 1;
            return `<label class="at-check"><input type="checkbox" data-check="${id}"${marcas[id] ? ' checked' : ''}${t ? '' : ' disabled'}><span>${esc(item)}</span></label>`;
          })
          .join('')}
      </fieldset>`
    ).join('');
    $('#checklist-estado').textContent = t
      ? `${hechos} de ${total} puntos verificados para ${t.estudiante || 'esta tesis'}.`
      : 'Seleccione una tesis para marcar los puntos verificados.';
  }

  /* ==================== IA: revisión y chat ==================== */

  function contextoParaIA() {
    const t = tesisActiva();
    if (!t) return null;
    const nombres = Object.fromEntries(ESTADOS.map((e) => [e.id, e.nombre]));
    // El nombre del estudiante no se envía.
    return {
      titulo: t.titulo,
      nivel: t.nivel,
      programa: t.programa,
      universidad: t.universidad,
      entrega: t.entrega,
      notas: t.notas,
      capitulos: t.capitulos.map((c) => ({ nombre: c.nombre, estado: nombres[c.estado] || c.estado })),
    };
  }

  async function conversar(cuerpo, alRecibir) {
    const respuesta = await api('/api/chat', cuerpo);
    if (respuesta.status === 401) {
      salir();
      throw new Error('La sesión caducó. Ingrese de nuevo la contraseña.');
    }
    if (!respuesta.ok || !respuesta.body) {
      let mensaje = `El servidor respondió con un error (${respuesta.status}).`;
      try {
        mensaje = (await respuesta.json()).error || mensaje;
      } catch { /* respuesta sin JSON */ }
      throw new Error(mensaje);
    }

    const lector = respuesta.body.getReader();
    const deco = new TextDecoder();
    let pendiente = '';
    let texto = '';
    let terminado = false;
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      pendiente += deco.decode(value, { stream: true });
      const eventos = pendiente.split('\n\n');
      pendiente = eventos.pop();
      for (const bloque of eventos) {
        const evento = (bloque.match(/^event: (.+)$/m) || [])[1];
        const datos = (bloque.match(/^data: (.+)$/m) || [])[1];
        if (!evento || !datos) continue;
        const d = JSON.parse(datos);
        if (evento === 'delta') {
          texto += d.text;
          alRecibir(texto);
        } else if (evento === 'error') {
          throw new Error(d.message);
        } else if (evento === 'done') {
          terminado = true;
          if (d.stop_reason === 'max_tokens') {
            texto += '\n\n*(La respuesta alcanzó la extensión máxima. Pida que continúe o envíe el texto por partes.)*';
            alRecibir(texto);
          }
        }
      }
    }
    if (!terminado && !texto) throw new Error('La conexión se interrumpió antes de recibir la respuesta.');
    return texto;
  }

  function leerPdf(archivo) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(String(lector.result).split(',')[1] || '');
      lector.onerror = () => rechazar(new Error('No se pudo leer el archivo PDF.'));
      lector.readAsDataURL(archivo);
    });
  }

  function marcarOcupado(valor) {
    ocupado = valor;
    $$('[data-ia]').forEach((b) => (b.disabled = valor));
  }

  async function revisar(form) {
    if (ocupado) return;
    const texto = form.texto.value.trim();
    const archivo = form.pdf.files[0];
    const salida = $('#revision-salida');
    const acciones = $('#revision-acciones');
    if (!texto && !archivo) {
      aviso('Pegue el texto o adjunte un PDF para revisar.');
      return;
    }
    if (archivo && archivo.size > 10 * 1024 * 1024) {
      aviso('El PDF supera los 10 MB. Envíelo por capítulos.');
      return;
    }
    marcarOcupado(true);
    acciones.hidden = true;
    ultimaRevision = '';
    salida.innerHTML = '<p class="at-pensando">Analizando el texto. Una revisión completa puede tardar uno o dos minutos…</p>';
    try {
      const pdf = archivo ? await leerPdf(archivo) : undefined;
      const t = tesisActiva();
      ultimaRevision = await conversar(
        {
          modo: 'revision',
          tesis: contextoParaIA(),
          revision: {
            tipo: form.tipo.value,
            nivel: t ? t.nivel : form.nivel.value,
            seccion: form.seccion.value,
            indicaciones: form.indicaciones.value,
          },
          pdf,
          messages: [{ role: 'user', content: texto || '(El texto está en el PDF adjunto.)' }],
        },
        (parcial) => (salida.innerHTML = `<div class="at-prosa">${markdown(parcial)}</div>`)
      );
      acciones.hidden = false;
    } catch (error) {
      salida.innerHTML = `<p class="at-error">${esc(error.message)}</p>`;
    } finally {
      marcarOcupado(false);
    }
  }

  function pintarChat(parcial) {
    const cont = $('#chat-mensajes');
    const mensajes = parcial === undefined ? chat : [...chat, { role: 'assistant', content: parcial }];
    cont.innerHTML = mensajes.length
      ? mensajes
          .map((m) =>
            m.role === 'user'
              ? `<div class="at-msg at-msg-user"><p>${esc(m.content).replace(/\n/g, '<br>')}</p></div>`
              : `<div class="at-msg at-msg-ia"><div class="at-prosa">${m.content ? markdown(m.content) : '<p class="at-pensando">Pensando…</p>'}</div></div>`
          )
          .join('')
      : `<div class="at-chat-vacio">
          <p>Consulte lo que necesite sobre las tesis que asesora. Algunas ideas:</p>
          <button type="button" data-sugerencia="¿Cómo se cita en APA 7 una fuente secundaria y cómo va en la lista de referencias?">Citar una fuente secundaria</button>
          <button type="button" data-sugerencia="Ayúdeme a redactar una retroalimentación clara y respetuosa para un estudiante cuyo marco teórico es una suma de citas sin análisis.">Redactar una retroalimentación</button>
          <button type="button" data-sugerencia="Propóngame un cronograma de trabajo por semanas para la tesis activa, según el estado de sus capítulos y la fecha de entrega.">Proponer un cronograma</button>
          <button type="button" data-sugerencia="¿Qué diferencias de exigencia debo aplicar al revisar la metodología de una tesis de maestría frente a una de doctorado?">Exigencia según el nivel</button>
        </div>`;
    cont.scrollTop = cont.scrollHeight;
  }

  async function enviarChat(texto) {
    if (ocupado || !texto.trim()) return;
    chat.push({ role: 'user', content: texto.trim() });
    marcarOcupado(true);
    pintarChat('');
    try {
      const respuesta = await conversar(
        { modo: 'chat', tesis: $('#chat-contexto').checked ? contextoParaIA() : null, messages: chat },
        (parcial) => pintarChat(parcial)
      );
      chat.push({ role: 'assistant', content: respuesta });
      pintarChat();
    } catch (error) {
      chat.pop();
      pintarChat();
      $('#chat-mensajes').insertAdjacentHTML('beforeend', `<p class="at-error">${esc(error.message)}</p>`);
      $('#chat-texto').value = texto;
    } finally {
      marcarOcupado(false);
    }
  }

  /* ==================== Pintado general ==================== */

  function pintarTodo() {
    pintarSelector();
    pintarLista();
    pintarDetalle();
    pintarReferencias();
    pintarChecklist();
    const t = tesisActiva();
    $('#revision-nivel-campo').hidden = Boolean(t);
    $('#btn-guardar-revision').hidden = !t;
  }

  /* ==================== Eventos ==================== */

  function iniciar() {
    cargar();

    // Acceso
    $('#acceso-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const boton = e.target.querySelector('button[type="submit"]');
      boton.disabled = true;
      await entrar($('#acceso-clave').value, $('#acceso-recordar').checked);
      boton.disabled = false;
    });
    $('#btn-salir').addEventListener('click', salir);

    // Pestañas
    $$('.at-tab').forEach((b) => b.addEventListener('click', () => abrirPestana(b.dataset.tab)));

    // Nueva tesis
    $('#form-nueva').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const t = nuevaTesis({ estudiante: f.estudiante.value.trim(), titulo: f.titulo.value.trim(), nivel: f.nivel.value });
      estado.tesis.push(t);
      estado.activa = t.id;
      guardar();
      f.reset();
      pintarTodo();
      aviso('Tesis creada con la estructura sugerida para su nivel.');
    });

    // Lista de tesis
    $('#lista-tesis').addEventListener('click', (e) => {
      const boton = e.target.closest('[data-abrir]');
      if (!boton) return;
      estado.activa = boton.dataset.abrir;
      guardar();
      pintarTodo();
    });

    // Detalle: campos
    const detalle = $('#detalle-tesis');
    detalle.addEventListener('change', (e) => {
      const t = tesisActiva();
      if (!t) return;
      const el = e.target;
      if (el.dataset.campo) {
        t[el.dataset.campo] = el.value;
        guardar();
        pintarSelector();
        pintarLista();
        if (['nivel', 'entrega', 'estudiante'].includes(el.dataset.campo)) pintarDetalle();
      } else if (el.dataset.capCampo) {
        const cap = t.capitulos.find((c) => c.id === el.closest('[data-cap]').dataset.cap);
        if (!cap) return;
        cap[el.dataset.capCampo] = el.value;
        guardar();
        pintarLista();
        if (['estado', 'fecha'].includes(el.dataset.capCampo)) pintarDetalle();
      }
    });
    detalle.addEventListener('click', (e) => {
      const t = tesisActiva();
      if (!t) return;
      const el = e.target.closest('button');
      if (!el) return;
      if (el.dataset.accion === 'agregar-capitulo') {
        t.capitulos.push({ id: uid(), nombre: 'Nuevo capítulo', estado: 'pendiente', fecha: '', nota: '' });
      } else if (el.dataset.quitarCap) {
        if (!confirm('¿Eliminar este capítulo y sus observaciones?')) return;
        t.capitulos = t.capitulos.filter((c) => c.id !== el.dataset.quitarCap);
      } else if (el.dataset.quitarBitacora) {
        if (!confirm('¿Eliminar esta anotación?')) return;
        t.bitacora = t.bitacora.filter((b) => b.id !== el.dataset.quitarBitacora);
      } else if (el.dataset.accion === 'eliminar-tesis') {
        if (!confirm(`¿Eliminar la tesis de ${t.estudiante || 'este estudiante'} con todo su seguimiento? Esta acción no se puede deshacer.`)) return;
        estado.tesis = estado.tesis.filter((x) => x.id !== t.id);
        estado.activa = estado.tesis[0]?.id || null;
      } else {
        return;
      }
      guardar();
      pintarTodo();
    });
    detalle.addEventListener('submit', (e) => {
      if (!e.target.matches('[data-form-bitacora]')) return;
      e.preventDefault();
      const t = tesisActiva();
      const texto = e.target.texto.value.trim();
      if (!t || !texto) return;
      t.bitacora.push({ id: uid(), fecha: e.target.fecha.value || hoy(), texto });
      guardar();
      pintarDetalle();
    });

    // Respaldo
    $('#btn-exportar').addEventListener('click', () => {
      descargar(`asistente-tesis-respaldo-${hoy()}.json`, JSON.stringify(estado, null, 2), 'application/json');
    });
    $('#input-importar').addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      try {
        const datos = JSON.parse(await archivo.text());
        if (!Array.isArray(datos.tesis)) throw new Error('formato');
        if (estado.tesis.length && !confirm('Se reemplazarán los datos actuales de este navegador por los del respaldo. ¿Continuar?')) return;
        estado = { sueltas: [], activa: null, ...datos };
        guardar();
        pintarTodo();
        aviso('Respaldo restaurado.');
      } catch {
        aviso('El archivo no es un respaldo válido del asistente.');
      }
    });

    // Citas
    $('#cita-tipo').innerHTML = Object.entries(APA.TIPOS).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join('');
    $('#cita-tipo').addEventListener('change', () => pintarCamposCita());
    $('#cita-campos').addEventListener('input', pintarVistaCita);
    $('#cita-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const tipo = $('#cita-tipo').value;
      const datos = datosCita();
      if (!datos.titulo?.trim()) {
        aviso('Escriba al menos el título de la obra.');
        return;
      }
      const lista = referencias();
      if (refEditando) {
        const r = lista.find((x) => x.id === refEditando);
        if (r) Object.assign(r, { tipo, datos });
      } else {
        lista.push({ id: uid(), tipo, datos });
      }
      refEditando = null;
      $('#cita-guardar').textContent = 'Guardar en la lista';
      guardar();
      pintarCamposCita();
      pintarReferencias();
      aviso('Referencia guardada.');
    });
    $('#cita-limpiar').addEventListener('click', () => {
      refEditando = null;
      $('#cita-guardar').textContent = 'Guardar en la lista';
      pintarCamposCita();
    });
    $('#cita-copiar').addEventListener('click', () => {
      const r = APA.generar($('#cita-tipo').value, datosCita());
      copiar(r.html, r.texto);
    });
    $('#refs-lista').addEventListener('click', (e) => {
      const el = e.target.closest('button');
      if (!el) return;
      const lista = referencias();
      const id = el.dataset.copiarRef || el.dataset.editarRef || el.dataset.quitarRef;
      const r = lista.find((x) => x.id === id);
      if (!r) return;
      if (el.dataset.copiarRef) {
        const apa = APA.generar(r.tipo, r.datos);
        copiar(apa.html, apa.texto);
      } else if (el.dataset.editarRef) {
        refEditando = r.id;
        $('#cita-tipo').value = r.tipo;
        pintarCamposCita(r.datos);
        $('#cita-guardar').textContent = 'Guardar cambios';
        $('#cita-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (confirm('¿Eliminar esta referencia de la lista?')) {
        lista.splice(lista.indexOf(r), 1);
        guardar();
        pintarReferencias();
      }
    });
    $('#refs-copiar').addEventListener('click', () => {
      const lista = referenciasOrdenadas();
      if (!lista.length) return aviso('La lista está vacía.');
      copiar(listaComoHtml(), lista.map((r) => r.apa.texto).join('\n'));
    });
    $('#refs-word').addEventListener('click', () => {
      if (!referencias().length) return aviso('La lista está vacía.');
      const doc = `<html><head><meta charset="utf-8"><title>Referencias</title></head><body style="font-family:'Times New Roman',serif;font-size:12pt"><p style="text-align:center;line-height:2;margin:0"><b>Referencias</b></p>${listaComoHtml()}</body></html>`;
      descargar('referencias-apa.doc', `﻿${doc}`, 'application/msword');
    });

    // Guía
    $('#guia-nivel').addEventListener('change', pintarGuia);
    $('#checklist').addEventListener('change', (e) => {
      const t = tesisActiva();
      if (!t || !e.target.dataset.check) return;
      t.checklist[e.target.dataset.check] = e.target.checked;
      guardar();
      pintarChecklist();
    });

    // Revisión
    $('#revision-form').addEventListener('submit', (e) => {
      e.preventDefault();
      revisar(e.target);
    });
    $('#btn-copiar-revision').addEventListener('click', () => {
      if (ultimaRevision) copiar(markdown(ultimaRevision), ultimaRevision);
    });
    $('#btn-guardar-revision').addEventListener('click', () => {
      const t = tesisActiva();
      if (!t || !ultimaRevision) return;
      const form = $('#revision-form');
      const tipo = form.tipo.options[form.tipo.selectedIndex].text;
      const seccion = form.seccion.value.trim();
      t.bitacora.push({ id: uid(), fecha: hoy(), titulo: `Revisión con IA: ${tipo}${seccion ? ` — ${seccion}` : ''}`, texto: ultimaRevision });
      guardar();
      pintarDetalle();
      aviso('Revisión guardada en la bitácora de la tesis.');
    });

    // Chat
    $('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const campo = $('#chat-texto');
      const texto = campo.value;
      campo.value = '';
      enviarChat(texto);
    });
    $('#chat-texto').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        $('#chat-form').requestSubmit();
      }
    });
    $('#chat-mensajes').addEventListener('click', (e) => {
      const el = e.target.closest('[data-sugerencia]');
      if (el) enviarChat(el.dataset.sugerencia);
    });
    $('#chat-nuevo').addEventListener('click', () => {
      if (ocupado) return;
      chat = [];
      pintarChat();
    });

    // Contenido estático
    pintarCamposCita();
    pintarGuia();
    pintarFormato();
    pintarChat();

    // Sesión recordada
    let recordada = '';
    try {
      recordada = sessionStorage.getItem(CLAVE_ACCESO) || localStorage.getItem(CLAVE_ACCESO) || '';
    } catch { /* sin almacenamiento */ }
    if (recordada) entrar(recordada, false);
    else $('#acceso-clave').focus();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
