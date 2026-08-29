namespace GameTimeGuard.Agent.Models;

public class BlockedGame
{
    public string ProcessName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? PathContains { get; set; }
}

/// <summary>
/// Config que llega del backend (modo, bolsa de horas, franja, juegos bloqueados).
/// Se cachea localmente para poder seguir bloqueando aunque no haya internet.
/// </summary>
public class DeviceConfig
{
    public string Mode { get; set; } = "budget"; // budget | window | both
    public int DailyBudgetMinutes { get; set; } = 180;
    public string WindowStart { get; set; } = "16:00";
    public string WindowEnd { get; set; } = "19:00";
    public List<BlockedGame> BlockedGames { get; set; } = new();
}

/// <summary>
/// Resultado de un sync exitoso: config + el estado de uso/permiso que calculo el servidor.
/// </summary>
public class SyncResult : DeviceConfig
{
    public string ServerTime { get; set; } = "";
    public double MinutesUsedToday { get; set; }
    public double RemainingBudgetMinutes { get; set; }
    public bool InWindow { get; set; }
    public bool AllowedRightNow { get; set; }
}

/// <summary>
/// Estado local persistido en disco, para sobrevivir reinicios y cortes de internet.
/// </summary>
public class LocalState
{
    public string LastKnownDate { get; set; } = "";
    public double MinutesUsedTodayLocal { get; set; }
    public double AccumulatedUnsyncedSeconds { get; set; }
    public DateTime? LastSuccessfulSyncUtc { get; set; }
    public DeviceConfig? LastConfig { get; set; }
}
