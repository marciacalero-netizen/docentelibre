using System.Net.Http.Json;
using System.Text.Json;
using GameTimeGuard.Agent.Models;

namespace GameTimeGuard.Agent.Services;

public class SyncRequestBody
{
    public string Hostname { get; set; } = "";
    public string AgentVersion { get; set; } = "";
    public string? RunningBlockedProcessName { get; set; }
    public double ElapsedSecondsRunningSinceLastSync { get; set; }
}

public class ApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public ApiClient(string apiBaseUrl, string deviceToken)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(apiBaseUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(8),
        };
        _http.DefaultRequestHeaders.Add("X-Device-Token", deviceToken);
    }

    public async Task<DeviceConfig?> GetConfigAsync(CancellationToken ct)
    {
        try
        {
            var resp = await _http.GetAsync("api/device/config", ct);
            if (!resp.IsSuccessStatusCode) return null;
            return await resp.Content.ReadFromJsonAsync<DeviceConfig>(JsonOpts, ct);
        }
        catch
        {
            return null;
        }
    }

    public async Task<SyncResult?> SyncAsync(SyncRequestBody body, CancellationToken ct)
    {
        try
        {
            var resp = await _http.PostAsJsonAsync("api/device/sync", body, JsonOpts, ct);
            if (!resp.IsSuccessStatusCode) return null;
            return await resp.Content.ReadFromJsonAsync<SyncResult>(JsonOpts, ct);
        }
        catch
        {
            return null;
        }
    }
}
