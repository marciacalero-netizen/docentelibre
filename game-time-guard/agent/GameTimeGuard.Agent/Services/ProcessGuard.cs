using System.Diagnostics;
using GameTimeGuard.Agent.Models;
using Microsoft.Extensions.Logging;

namespace GameTimeGuard.Agent.Services;

public record ScanResult(string? RunningBlockedProcessName, bool KilledSomething);

/// <summary>
/// Revisa los procesos en ejecucion y mata los que esten en la lista de juegos
/// bloqueados cuando no esta permitido jugar. Si esta permitido, solo informa
/// cual esta corriendo (para contar el tiempo de uso).
/// </summary>
public class ProcessGuard
{
    private readonly ILogger<ProcessGuard> _logger;

    public ProcessGuard(ILogger<ProcessGuard> logger)
    {
        _logger = logger;
    }

    public ScanResult Scan(List<BlockedGame> blockedGames, bool allowedRightNow)
    {
        if (blockedGames.Count == 0) return new ScanResult(null, false);

        string? runningBlocked = null;
        bool killedSomething = false;

        Process[] processes;
        try
        {
            processes = Process.GetProcesses();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo enumerar procesos");
            return new ScanResult(null, false);
        }

        foreach (var proc in processes)
        {
            try
            {
                string procExeName;
                try
                {
                    procExeName = proc.ProcessName + ".exe";
                }
                catch
                {
                    continue;
                }

                var match = blockedGames.FirstOrDefault(g =>
                    string.Equals(g.ProcessName, procExeName, StringComparison.OrdinalIgnoreCase));
                if (match == null) continue;

                if (!string.IsNullOrEmpty(match.PathContains))
                {
                    string? fullPath = TryGetMainModulePath(proc);
                    if (fullPath == null || !fullPath.Contains(match.PathContains, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                }

                runningBlocked = match.ProcessName;

                if (!allowedRightNow)
                {
                    try
                    {
                        proc.Kill(entireProcessTree: true);
                        killedSomething = true;
                        _logger.LogInformation("Bloqueado y cerrado: {Process}", match.DisplayName);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "No se pudo cerrar {Process}", match.DisplayName);
                    }
                }
            }
            catch
            {
                // Algunos procesos del sistema no se pueden inspeccionar; se ignoran.
            }
            finally
            {
                proc.Dispose();
            }
        }

        return new ScanResult(runningBlocked, killedSomething);
    }

    private static string? TryGetMainModulePath(Process proc)
    {
        try
        {
            return proc.MainModule?.FileName;
        }
        catch
        {
            return null;
        }
    }
}
