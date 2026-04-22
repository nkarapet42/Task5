namespace MusicStore.Localization;

public class LocaleDataModel
{
    public string Locale { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public List<string> FirstNames { get; set; } = new();
    public List<string> LastNames { get; set; } = new();
    public List<string> BandPrefixes { get; set; } = new();
    public List<string> BandNouns { get; set; } = new();
    public List<string> AlbumAdjectives { get; set; } = new();
    public List<string> AlbumNouns { get; set; } = new();
    public List<string> Genres { get; set; } = new();
    public List<string> ReviewPhrases { get; set; } = new();
    public List<string> ReviewConnectors { get; set; } = new();
    public List<string> LyricsVerbs { get; set; } = new();
    public List<string> LyricsNouns { get; set; } = new();
    public List<string> LyricsAdjectives { get; set; } = new();
    public List<string> LyricsFillers { get; set; } = new();
    public List<string> LyricsChorusStarters { get; set; } = new();
}

public interface ILocaleDataProvider
{
    LocaleDataModel Get(string locale);
    IEnumerable<(string locale, string displayName)> GetAvailableLocales();
}
