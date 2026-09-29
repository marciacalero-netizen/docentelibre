using Microsoft.Extensions.Logging;

namespace GameTimeGuard.Agent.Services;

/// <summary>
/// Bloquea sitios web (independientemente del navegador) agregando entradas al
/// archivo hosts de Windows que redirigen los dominios configurados a
/// 127.0.0.1. Solo Administradores/SYSTEM pueden escribir ese archivo, asi
/// que un usuario estandar no puede revertirlo a mano.
/// </summary>
public class HostsFileManager
{
    private readonly ILogger<HostsFileManager> _logger;

    private const string BeginMarker = "# BEGIN GameTimeGuard - generado automaticamente, no editar";
    private const string EndMarker = "# END GameTimeGuard";

    private static readonly string HostsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.System),
        "drivers", "etc", "hosts");

    public HostsFileManager(ILogger<HostsFileManager> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Reescribe el bloque de GameTimeGuard en el hosts. Si block es true,
    /// agrega entradas que redirigen cada dominio a 127.0.0.1. Si es false,
    /// solo limpia el bloque (deja el resto del archivo intacto).
    /// </summary>
    public void Apply(List<string> domains, bool block)
    {
        try
        {
            var lines = File.Exists(HostsPath)
                ? File.ReadAllLines(HostsPath).ToList()
                : new List<string>();

            var beginIdx = lines.FindIndex(l => l.Trim() == BeginMarker);
            var endIdx = lines.FindIndex(l => l.Trim() == EndMarker);
            if (beginIdx >= 0 && endIdx >= beginIdx)
            {
                lines.RemoveRange(beginIdx, endIdx - beginIdx + 1);
            }

            if (block && domains.Count > 0)
            {
                lines.Add(BeginMarker);
                foreach (var domain in domains.Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    var clean = domain.Trim().ToLowerInvariant();
                    if (clean.Length == 0) continue;
                    lines.Add($"127.0.0.1 {clean}");
                    lines.Add($"127.0.0.1 www.{clean}");
                }
                lines.Add(EndMarker);
            }

            File.WriteAllLines(HostsPath, lines);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo actualizar el archivo hosts");
        }
    }
}
