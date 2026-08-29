using GameTimeGuard.Agent.Models;

namespace GameTimeGuard.Agent.Services;

public record Allowance(bool Allowed, bool InWindow, double RemainingBudgetMinutes, string Reason);

/// <summary>
/// Replica en el agente la misma logica que el backend (ver backend/src/timeLogic.js),
/// usando la hora local de la PC. Se usa cuando no hay conexion con el servidor,
/// para que el bloqueo siga funcionando aunque se corte internet.
/// </summary>
public static class TimeAllowanceCalculator
{
    public static bool IsInWindow(TimeOnly now, string start, string end)
    {
        if (!TimeOnly.TryParse(start, out var s) || !TimeOnly.TryParse(end, out var e)) return true;
        if (s == e) return false;
        if (s < e) return now >= s && now < e;
        // Franja que cruza la medianoche
        return now >= s || now < e;
    }

    public static Allowance Compute(DeviceConfig config, double minutesUsedToday, DateTime nowLocal)
    {
        var now = TimeOnly.FromDateTime(nowLocal);
        var inWindow = IsInWindow(now, config.WindowStart, config.WindowEnd);
        var remaining = Math.Max(0, config.DailyBudgetMinutes - minutesUsedToday);

        bool allowed;
        string reason;
        switch (config.Mode)
        {
            case "window":
                allowed = inWindow;
                reason = allowed ? "dentro_de_franja" : "fuera_de_franja";
                break;
            case "both":
                allowed = inWindow && remaining > 0;
                reason = !inWindow ? "fuera_de_franja" : remaining <= 0 ? "sin_tiempo" : "permitido";
                break;
            default: // budget
                allowed = remaining > 0;
                reason = allowed ? "permitido" : "sin_tiempo";
                break;
        }

        return new Allowance(allowed, inWindow, remaining, reason);
    }
}
