/**
 * DOCENTE LIBRE — Comportamiento compartido
 * Navegación, formularios, animaciones sutiles y helpers de renderizado
 * de tarjetas (artículos/guías) a partir de js/data.js.
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileNav();
  initScrollReveal();
  initForms();
});

/* ---- Header: sombra al hacer scroll ---- */
function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---- Menú hamburguesa ---- */
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.mobile-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---- Scroll reveal (sutil) ----
   Progressive enhancement: content stays visible unless JS confirms the
   reveal system is armed. A safety timeout force-reveals everything even
   if an element never scrolls into view (screen readers, page-scanning
   crawlers, or a screenshot tool that never triggers a real scroll). */
function initScrollReveal() {
  const items = document.querySelectorAll('[data-reveal]:not(.is-visible)');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  document.body.classList.add('reveal-armed');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  items.forEach((el) => observer.observe(el));

  window.setTimeout(() => {
    items.forEach((el) => el.classList.add('is-visible'));
    observer.disconnect();
  }, 4000);
}

/* ==========================================================================
   FORMULARIOS
   Validación de nombre/email, mensaje de confirmación en pantalla.
   No se conecta a ningún servicio externo todavía (ver SITE_CONFIG.FORM_ENDPOINT).
   No se generan descargas simuladas.
   ========================================================================== */
function initForms() {
  document.querySelectorAll('form[data-validate]').forEach((form) => {
    form.addEventListener('submit', (event) => handleFormSubmit(event, form));
  });
}

function handleFormSubmit(event, form) {
  event.preventDefault();

  let valid = true;
  const fields = form.querySelectorAll('[data-required]');

  fields.forEach((field) => {
    const wrapper = field.closest('.form-field');
    const value = field.value.trim();
    let fieldValid = value.length > 0;

    if (field.type === 'email' && fieldValid) {
      fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    if (wrapper) wrapper.classList.toggle('has-error', !fieldValid);
    if (!fieldValid) valid = false;
  });

  if (!valid) return;

  const successBox = form.querySelector('.form-success');
  const guideLinkHolder = form.querySelector('[data-guide-link]');
  const nameField = form.querySelector('[name="nombre"]');
  const name = nameField ? nameField.value.trim().split(' ')[0] : '';

  if (successBox) {
    let message = successBox.dataset.baseMessage || successBox.textContent;
    if (name) message = message.replace('{{nombre}}', name);
    successBox.textContent = message;
    successBox.classList.add('is-visible');
  }

  // Si en el futuro existe una URL real de guía (SITE_CONFIG.FREE_GUIDE_URL),
  // se habilita el enlace de descarga. Hasta entonces no se ofrece descarga.
  if (guideLinkHolder) {
    const guideUrl = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.FREE_GUIDE_URL) || '';
    if (guideUrl) {
      guideLinkHolder.innerHTML = `<a class="btn btn-primary btn-sm" href="${guideUrl}" target="_blank" rel="noopener">Descargar ahora</a>`;
    }
  }

  form.classList.add('is-submitted');
  form.reset();

  // TODO: cuando exista SITE_CONFIG.FORM_ENDPOINT, enviar los datos aquí
  // (Brevo, Mailchimp, Formspree o backend propio) antes de mostrar la confirmación.
}

/* ==========================================================================
   HELPERS DE RENDERIZADO — usados por las páginas de listado/artículo
   ========================================================================== */
function formatDate(isoDate) {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function categoryLabel(slug) {
  return (typeof CATEGORIES !== 'undefined' && CATEGORIES[slug]) ? CATEGORIES[slug].label : slug;
}

function placeholderMedia({ label, note, ratioClass = '' }) {
  return `
    <div class="media-placeholder ${ratioClass}" role="img" aria-label="${label}">
      <svg class="ph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3"></rect>
        <circle cx="8.5" cy="9.5" r="1.5"></circle>
        <path d="M21 15l-5-5-4 4-3-3-6 6"></path>
      </svg>
      <span class="ph-label">${label}</span>
      ${note ? `<span class="ph-note">${note}</span>` : ''}
    </div>`;
}

function articleCardHTML(article) {
  return `
    <a class="article-card" href="articulo.html?slug=${article.slug}" data-reveal>
      <div class="article-thumb">
        ${placeholderMedia({ label: 'Imagen del artículo', note: 'Pendiente de asignar' })}
      </div>
      <div class="article-body">
        <span class="tag">${categoryLabel(article.category)}</span>
        <h3>${article.title}</h3>
        <p>${article.excerpt}</p>
        <div class="article-meta">
          <time datetime="${article.date}">${formatDate(article.date)}</time>
        </div>
        <span class="read-more">Leer artículo →</span>
      </div>
    </a>`;
}

function guideCardHTML(guide) {
  const actionLabel = guide.downloadUrl ? 'Descargar' : 'Ver guía';
  const actionHref = guide.downloadUrl || `guias.html#${guide.slug}`;
  return `
    <article class="guide-card" id="${guide.slug}" data-reveal>
      <div class="guide-thumb">
        ${placeholderMedia({ label: 'Portada de la guía', note: 'Pendiente de diseñar' })}
      </div>
      <span class="tag">${guide.free ? 'Guía gratuita' : 'Guía'}</span>
      <h3>${guide.title}</h3>
      <p>${guide.description}</p>
      <div class="guide-actions">
        <a class="btn btn-ghost btn-sm" href="${actionHref}">${actionLabel}</a>
      </div>
    </article>`;
}

function renderCategoryPage(slug) {
  const cat = (typeof CATEGORIES !== 'undefined') ? CATEGORIES[slug] : null;
  const titleEl = document.getElementById('cat-title');
  const descEl = document.getElementById('cat-description');
  const listEl = document.getElementById('cat-articles');

  if (!cat) {
    if (titleEl) titleEl.textContent = 'Categoría no encontrada';
    if (descEl) descEl.textContent = '';
    if (listEl) listEl.innerHTML = '<p>Esta categoría no existe todavía.</p>';
    return;
  }

  document.title = `${cat.label} | Docente Libre`;
  const metaDesc = document.getElementById('meta-description');
  if (metaDesc) metaDesc.setAttribute('content', cat.description);
  if (titleEl) titleEl.textContent = cat.label;
  if (descEl) descEl.textContent = cat.description;

  const items = ARTICLES.filter((a) => a.category === slug);
  if (listEl) {
    listEl.innerHTML = items.length
      ? items.map(articleCardHTML).join('')
      : '<p>Todavía no hay artículos publicados en esta categoría. Vuelve pronto.</p>';
  }

  initScrollReveal();
}

function topicIconSVG(slug) {
  const icons = {
    adolescencia: '<path d="M12 3a4 4 0 100 8 4 4 0 000-8z"/><path d="M5 21c0-4 3-6.5 7-6.5S19 17 19 21"/>',
    psicologia: '<path d="M12 3c-3 0-5 2.2-5 5 0 2 1 3 1 4.5V15a2 2 0 002 2h4a2 2 0 002-2v-2.5c0-1.5 1-2.5 1-4.5 0-2.8-2-5-5-5z"/><path d="M10 21h4"/>',
    pedagogia: '<path d="M4 6l8-3 8 3-8 3-8-3z"/><path d="M4 6v7c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>',
    familia: '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5"/><path d="M11 20c0-3 2.5-5 5-5s5 2 5 5"/>',
    tecnologia: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>'
  };
  return `<svg class="topic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icons[slug] || ''}</svg>`;
}
