using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MusicStore.Data;

namespace MusicStore.Localization;

public class LocaleDataProvider : ILocaleDataProvider
{
    private readonly Dictionary<string, LocaleDataModel> _cache = new();
    public LocaleDataProvider(AppDbContext db)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var rows = db.LocaleDatasets
            .AsNoTracking()
            .OrderBy(x => x.DisplayName)
            .ToList();

        foreach (var row in rows)
        {
            var model = JsonSerializer.Deserialize<LocaleDataModel>(row.PayloadJson, options);
            if (model is not null && !string.IsNullOrWhiteSpace(model.Locale))
                _cache[model.Locale] = model;
        }

        if (_cache.Count > 0 && !_cache.ContainsKey("en-US"))
            _cache["en-US"] = _cache.Values.First();
    }

    public LocaleDataModel Get(string locale)
    {
        if (_cache.TryGetValue(locale, out var model))
            return model;

        if (_cache.Count == 0)
            throw new InvalidOperationException("No locale lookup data found in the database.");

        return _cache["en-US"];
    }

    public IEnumerable<(string locale, string displayName)> GetAvailableLocales()
        => _cache.Values
            .OrderBy(m => m.DisplayName)
            .Select(m => (m.Locale, m.DisplayName));
}
