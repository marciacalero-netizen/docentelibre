(() => {
  'use strict';

  const API = ''; // mismo origen (el backend sirve este panel)
  const TOKEN_KEY = 'gtg_token';
  const STATUS_POLL_MS = 15000;

  const el = (id) => document.getElementById(id);
  const loginScreen = el('loginScreen');
  const app = el('app');
  const toastEl = el('toast');

  let statusTimer = null;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch(API + path, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      clearToken();
      showLogin();
      throw new Error('Sesion expirada');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error de red');
    return data;
  }

  function showLogin() {
    stopStatusPolling();
    loginScreen.hidden = false;
    app.hidden = true;
  }

  function showApp() {
    loginScreen.hidden = true;
    app.hidden = false;
    loadEverything();
    startStatusPolling();
  }

  // ---------- Login ----------
  el('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = el('loginPassword').value;
    el('loginError').textContent = '';
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      setToken(data.token);
      el('loginPassword').value = '';
      showApp();
    } catch (err) {
      el('loginError').textContent = err.message;
    }
  });

  el('logoutBtn').addEventListener('click', () => {
    clearToken();
    showLogin();
  });

  // ---------- Status ----------
  function formatMinutes(min) {
    const m = Math.max(0, Math.round(min));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h}h ${rest}min` : `${h}h`;
  }

  function renderStatus(s) {
    const onlinePill = el('deviceOnlinePill');
    if (s.device.online) {
      onlinePill.textContent = '● conectado';
      onlinePill.className = 'status-pill ok';
    } else {
      onlinePill.textContent = '● desconectado';
      onlinePill.className = 'status-pill offline';
    }

    const big = el('bigStatus');
    if (s.allowedRightNow) {
      big.textContent = 'Puede jugar';
      big.className = 'big-status ok';
    } else {
      big.textContent = 'Bloqueado';
      big.className = 'big-status blocked';
    }

    let detail = '';
    if (s.mode === 'window' || s.mode === 'both') {
      detail += `Franja: ${s.windowStart} - ${s.windowEnd} (${s.inWindow ? 'dentro' : 'fuera'} de horario). `;
    }
    if (s.mode === 'budget' || s.mode === 'both') {
      detail += `Bolsa diaria: ${formatMinutes(s.dailyBudgetMinutes)}${s.bonusMinutes ? ' + ' + formatMinutes(s.bonusMinutes) + ' regalo' : ''}.`;
    }
    el('statusDetail').textContent = detail;

    const pct = s.dailyBudgetMinutes + s.bonusMinutes > 0
      ? Math.min(100, (s.minutesUsedToday / (s.dailyBudgetMinutes + s.bonusMinutes)) * 100)
      : 0;
    const fill = el('progressFill');
    fill.style.width = pct + '%';
    fill.className = 'progress-fill' + (pct >= 100 ? ' danger' : pct >= 75 ? ' warn' : '');

    el('minutesUsedLabel').textContent = `${formatMinutes(s.minutesUsedToday)} usados`;
    el('minutesRemainingLabel').textContent = `${formatMinutes(s.remainingBudgetMinutes)} restantes`;

    const d = s.device;
    if (d.hostname || d.lastSeenAt) {
      const parts = [];
      if (d.hostname) parts.push(`PC: ${d.hostname}`);
      if (d.currentlyRunningGame) parts.push(`Jugando ahora: ${d.currentlyRunningGame}`);
      if (d.lastSeenAt) parts.push(`Ultima conexion: ${d.lastSeenAt} UTC`);
      el('deviceInfo').textContent = parts.join(' · ');
    } else {
      el('deviceInfo').textContent = 'Todavia no se conecto ningun dispositivo. Instala el agente en la PC.';
    }
  }

  async function loadStatus() {
    try {
      const s = await api('/api/status');
      renderStatus(s);
    } catch (err) {
      // silencioso en el polling, ya se maneja el 401 arriba
    }
  }

  function startStatusPolling() {
    stopStatusPolling();
    loadStatus();
    statusTimer = setInterval(loadStatus, STATUS_POLL_MS);
  }
  function stopStatusPolling() {
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = null;
  }

  el('giveTimeBtn').addEventListener('click', async () => {
    try {
      await api('/api/status/adjust', { method: 'POST', body: JSON.stringify({ deltaMinutes: 30 }) });
      showToast('Se agregaron 30 minutos de regalo');
      loadStatus();
    } catch (err) {
      showToast(err.message);
    }
  });

  el('resetTodayBtn').addEventListener('click', async () => {
    if (!confirm('¿Reiniciar el uso de hoy a cero?')) return;
    try {
      await api('/api/status/reset-today', { method: 'POST' });
      showToast('Uso de hoy reiniciado');
      loadStatus();
    } catch (err) {
      showToast(err.message);
    }
  });

  // ---------- Config ----------
  async function loadConfig() {
    const { settings, games } = await api('/api/config');
    el('modeSelect').value = settings.mode;
    el('budgetInput').value = settings.daily_budget_minutes;
    el('windowStartInput').value = settings.window_start;
    el('windowEndInput').value = settings.window_end;
    renderGames(games);
  }

  el('saveConfigBtn').addEventListener('click', async () => {
    const msg = el('configMsg');
    msg.textContent = '';
    try {
      await api('/api/config', {
        method: 'PUT',
        body: JSON.stringify({
          mode: el('modeSelect').value,
          dailyBudgetMinutes: Number(el('budgetInput').value),
          windowStart: el('windowStartInput').value,
          windowEnd: el('windowEndInput').value,
        }),
      });
      showToast('Configuracion guardada');
      loadStatus();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  // ---------- Juegos ----------
  function renderGames(games) {
    const list = el('gamesList');
    if (!games.length) {
      list.innerHTML = '<p class="muted">Todavia no agregaste ningun juego.</p>';
      return;
    }
    list.innerHTML = '';
    games.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'game-item';
      row.innerHTML = `
        <div>
          <div class="name">${escapeHtml(g.display_name)}</div>
          <div class="process">${escapeHtml(g.process_name)}</div>
        </div>
        <button class="danger small" data-id="${g.id}">Quitar</button>
      `;
      row.querySelector('button').addEventListener('click', async () => {
        try {
          await api(`/api/config/games/${g.id}`, { method: 'DELETE' });
          loadConfig();
          showToast('Juego eliminado');
        } catch (err) {
          showToast(err.message);
        }
      });
      list.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  el('addGameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = el('addGameMsg');
    msg.textContent = '';
    try {
      await api('/api/config/games', {
        method: 'POST',
        body: JSON.stringify({
          displayName: el('gameDisplayName').value.trim(),
          processName: el('gameProcessName').value.trim(),
        }),
      });
      el('gameDisplayName').value = '';
      el('gameProcessName').value = '';
      loadConfig();
      showToast('Juego agregado');
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  // ---------- Token de dispositivo ----------
  el('showTokenBtn').addEventListener('click', async () => {
    const box = el('deviceTokenBox');
    if (!box.hidden) { box.hidden = true; return; }
    try {
      const { deviceToken } = await api('/api/device-token');
      box.textContent = deviceToken;
      box.hidden = false;
    } catch (err) {
      showToast(err.message);
    }
  });

  el('regenTokenBtn').addEventListener('click', async () => {
    if (!confirm('Esto invalida el token anterior: vas a tener que reconfigurar el agente en la PC con el nuevo token. ¿Continuar?')) return;
    try {
      const { deviceToken } = await api('/api/config/device-token/regenerate', { method: 'POST' });
      const box = el('deviceTokenBox');
      box.textContent = deviceToken;
      box.hidden = false;
      showToast('Token regenerado');
    } catch (err) {
      showToast(err.message);
    }
  });

  // ---------- Clave ----------
  el('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = el('passwordMsg');
    msg.textContent = '';
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: el('currentPassword').value,
          newPassword: el('newPassword').value,
        }),
      });
      el('changePasswordForm').reset();
      showToast('Clave actualizada');
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  function loadEverything() {
    loadConfig().catch((err) => showToast(err.message));
  }

  // ---------- Arranque ----------
  if (getToken()) {
    showApp();
  } else {
    showLogin();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
