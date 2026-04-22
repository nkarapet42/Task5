using System.Text.Json;

namespace MusicStore.Localization;

public class LocaleDataProvider : ILocaleDataProvider
{
    private readonly Dictionary<string, LocaleDataModel> _cache = new();
    private readonly string _dataPath;

    public LocaleDataProvider(IWebHostEnvironment env)
    {
        _dataPath = Path.Combine(env.ContentRootPath, "Localization", "LocaleData");
        LoadAll();
    }

    private void LoadAll()
    {
        foreach (var file in Directory.GetFiles(_dataPath, "*.json"))
        {
            var json = File.ReadAllText(file);
            var model = JsonSerializer.Deserialize<LocaleDataModel>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (model != null)
                _cache[model.Locale] = model;
        }
    }

    public LocaleDataModel Get(string locale)
    {
        if (_cache.TryGetValue(locale, out var model))
            return model;
        return _cache["en-US"];
    }

    public IEnumerable<(string locale, string displayName)> GetAvailableLocales()
        => _cache.Values
            .OrderBy(m => m.DisplayName)
            .Select(m => (m.Locale, m.DisplayName));
}
