function localDateParts(timezone, date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${hh}:${parts.minute}`,
  };
}

function isInWindow(hhmm, start, end) {
  if (!start || !end) return true;
  if (start === end) return false;
  if (start < end) {
    return hhmm >= start && hhmm < end;
  }
  // Franja que cruza la medianoche (ej. 22:00 a 02:00)
  return hhmm >= start || hhmm < end;
}

/**
 * Calcula si se permite jugar ahora mismo segun el modo configurado.
 * @param {object} settings fila de la tabla settings
 * @param {number} minutesUsedToday minutos ya usados hoy (usage_daily.minutes_used)
 * @param {number} bonusMinutes minutos extra otorgados hoy (usage_daily.bonus_minutes)
 * @param {Date} now
 */
function computeAllowance(settings, minutesUsedToday, bonusMinutes, now = new Date()) {
  const { dateStr, hhmm } = localDateParts(settings.timezone, now);
  const budgetTotal = settings.daily_budget_minutes + (bonusMinutes || 0);
  const remainingBudgetMinutes = Math.max(0, budgetTotal - (minutesUsedToday || 0));
  const inWindow = isInWindow(hhmm, settings.window_start, settings.window_end);

  let allowed;
  let reason;
  if (settings.mode === 'window') {
    allowed = inWindow;
    reason = allowed ? 'dentro_de_franja' : 'fuera_de_franja';
  } else if (settings.mode === 'both') {
    allowed = inWindow && remainingBudgetMinutes > 0;
    reason = !inWindow ? 'fuera_de_franja' : remainingBudgetMinutes <= 0 ? 'sin_tiempo' : 'permitido';
  } else {
    // 'budget'
    allowed = remainingBudgetMinutes > 0;
    reason = allowed ? 'permitido' : 'sin_tiempo';
  }

  return { dateStr, hhmm, inWindow, remainingBudgetMinutes, allowed, reason };
}

module.exports = { computeAllowance, isInWindow, localDateParts };
