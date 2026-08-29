using System.Text.Json;
using GameTimeGuard.Agent.Models;
using GameTimeGuard.Agent.Services;

namespace GameTimeGuard.Agent;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly IConfiguration _configuration;
    private readonly ProcessGuard _processGuard;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private const string AgentVersion = "1.0.0";

    public Worker(ILogger<Worker> logger, IConfiguration configuration, ProcessGuard processGuard)
    {
        _logger = logger;
        _configuration = configuration;
        _processGuard = processGuard;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var section = _configuration.GetSection("GameTimeGuard");
        var pollIntervalSeconds = section.GetValue<int?>("PollIntervalSeconds") ?? 3;
        var syncIntervalSeconds = section.GetValue<int?>("SyncIntervalSeconds") ?? 20;
        var configFilePath = section.GetValue<string>("ConfigFilePath") ?? @"C:\ProgramData\GameTimeGuard\agent-config.json";
        var stateFilePath = section.GetValue<string>("StateFilePath") ?? @"C:\ProgramData\GameTimeGuard\agent-state.json";

        var stateStore = new LocalStateStore(stateFilePath);
        var state = stateStore.Load();

        ApiClient? apiClient = null;
        var hostname = Environment.MachineName;
        var lastSync = DateTime.MinValue;

        _logger.LogInformation("Game Time Guard Agent iniciado. Version {Version}", AgentVersion);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Reintenta cargar la config de instalacion hasta que exista (por si el
                // servicio arranca antes de que install.ps1 termine de escribirla).
                if (apiClient == null)
                {
                    apiClient = TryLoadApiClient(configFilePath);
                    if (apiClient == null)
                    {
                        _logger.LogWarning("Todavia no hay configuracion en {Path}. Reintentando en 30s.", configFilePath);
                        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                        continue;
                    }
                }

                var today = DateTime.Now.ToString("yyyy-MM-dd");
                if (state.LastKnownDate != today)
                {
                    state.LastKnownDate = today;
                    state.MinutesUsedTodayLocal = 0;
                }

                var config = state.LastConfig;
                var allowedNow = true;
                if (config != null)
                {
                    var allowance = TimeAllowanceCalculator.Compute(config, state.MinutesUsedTodayLocal, DateTime.Now);
                    allowedNow = allowance.Allowed;
                }

                var scan = config != null
                    ? _processGuard.Scan(config.BlockedGames, allowedNow)
                    : new ScanResult(null, false);

                if (scan.RunningBlockedProcessName != null)
                {
                    var elapsedMinutes = pollIntervalSeconds / 60.0;
                    state.MinutesUsedTodayLocal += elapsedMinutes;
                    state.AccumulatedUnsyncedSeconds += pollIntervalSeconds;
                }

                var dueForSync = (DateTime.UtcNow - lastSync).TotalSeconds >= syncIntervalSeconds;
                if (dueForSync)
                {
                    var result = await apiClient.SyncAsync(new SyncRequestBody
                    {
                        Hostname = hostname,
                        AgentVersion = AgentVersion,
                        RunningBlockedProcessName = scan.RunningBlockedProcessName,
                        ElapsedSecondsRunningSinceLastSync = state.AccumulatedUnsyncedSeconds,
                    }, stoppingToken);

                    lastSync = DateTime.UtcNow;

                    if (result != null)
                    {
                        state.LastConfig = new DeviceConfig
                        {
                            Mode = result.Mode,
                            DailyBudgetMinutes = result.DailyBudgetMinutes,
                            WindowStart = result.WindowStart,
                            WindowEnd = result.WindowEnd,
                            BlockedGames = result.BlockedGames,
                        };
                        state.MinutesUsedTodayLocal = result.MinutesUsedToday;
                        state.AccumulatedUnsyncedSeconds = 0;
                        state.LastSuccessfulSyncUtc = DateTime.UtcNow;
                        _logger.LogDebug("Sync OK. Permitido={Allowed} Restante={Remaining}min", result.AllowedRightNow, result.RemainingBudgetMinutes);
                    }
                    else
                    {
                        _logger.LogWarning("No se pudo sincronizar con el servidor; se sigue bloqueando con la ultima config conocida.");
                    }

                    stateStore.Save(state);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inesperado en el ciclo del agente");
            }

            await Task.Delay(TimeSpan.FromSeconds(pollIntervalSeconds), stoppingToken);
        }
    }

    private ApiClient? TryLoadApiClient(string configFilePath)
    {
        try
        {
            if (!File.Exists(configFilePath)) return null;
            var json = File.ReadAllText(configFilePath);
            var cfg = JsonSerializer.Deserialize<AgentConfigFile>(json, JsonOpts);
            if (cfg == null || string.IsNullOrWhiteSpace(cfg.ApiBaseUrl) || string.IsNullOrWhiteSpace(cfg.DeviceToken))
            {
                return null;
            }
            return new ApiClient(cfg.ApiBaseUrl, cfg.DeviceToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "No se pudo leer {Path}", configFilePath);
            return null;
        }
    }
}
