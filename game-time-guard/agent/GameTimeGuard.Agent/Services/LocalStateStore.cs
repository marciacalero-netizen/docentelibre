using System.Text.Json;
using GameTimeGuard.Agent.Models;

namespace GameTimeGuard.Agent.Services;

public class LocalStateStore
{
    private readonly string _path;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public LocalStateStore(string path)
    {
        _path = path;
    }

    public LocalState Load()
    {
        try
        {
            if (!File.Exists(_path)) return new LocalState();
            var json = File.ReadAllText(_path);
            return JsonSerializer.Deserialize<LocalState>(json, JsonOpts) ?? new LocalState();
        }
        catch
        {
            return new LocalState();
        }
    }

    public void Save(LocalState state)
    {
        try
        {
            var dir = Path.GetDirectoryName(_path);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
            var tmp = _path + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(state, JsonOpts));
            File.Copy(tmp, _path, overwrite: true);
            File.Delete(tmp);
        }
        catch
        {
            // Si no se puede persistir (disco lleno, permisos), seguimos funcionando en memoria.
        }
    }
}
