using System.Text.Json;
using MusicStore.Data;

namespace MusicStore.Localization;

public static class LocaleLookupSeeder
{
    public static void SeedFromJson(AppDbContext db, IWebHostEnvironment env)
    {
        var dataPath = Path.Combine(env.ContentRootPath, "Localization", "LocaleData");
        if (!Directory.Exists(dataPath))
        {
            return;
        }

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        foreach (var file in Directory.GetFiles(dataPath, "*.json"))
        {
            var json = File.ReadAllText(file);
            var model = JsonSerializer.Deserialize<LocaleDataModel>(json, options);
            if (model is null || string.IsNullOrWhiteSpace(model.Locale))
            {
                continue;
            }

            var payload = JsonSerializer.Serialize(model);
            var existing = db.LocaleDatasets.Find(model.Locale);
            if (existing is null)
            {
                db.LocaleDatasets.Add(new LocaleDatasetEntity
                {
                    Locale = model.Locale,
                    DisplayName = model.DisplayName,
                    PayloadJson = payload
                });
            }
            else
            {
                existing.DisplayName = model.DisplayName;
                existing.PayloadJson = payload;
            }
        }

        db.SaveChanges();
    }
}
