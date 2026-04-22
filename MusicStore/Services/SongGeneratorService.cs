using MusicStore.Localization;
using MusicStore.Models;

namespace MusicStore.Services;

public class SongGeneratorService : ISongGeneratorService
{
    private readonly ILocaleDataProvider _localeData;

    public SongGeneratorService(ILocaleDataProvider localeData)
    {
        _localeData = localeData;
    }

    private static long CombineSeed(long userSeed, int page)
        => userSeed * 6364136223846793005L + page * 1442695040888963407L;

    private static long CombineSeedForRecord(long userSeed, int absoluteIndex)
        => userSeed ^ (absoluteIndex * 2654435761L);

    public IEnumerable<SongRecord> GeneratePage(PageRequest request)
    {
        var locale = _localeData.Get(request.Locale);
        long pageSeed = CombineSeed(request.Seed, request.Page);
        var contentRng = DeterministicRandom64.Create(pageSeed, 0xC0DEC0DEC0DEC0DEUL);

        long likesSeed = CombineSeed(request.Seed ^ 0xDEADBEEFL, request.Page);
        var likesRng = DeterministicRandom64.Create(likesSeed, 0x1A2B3C4D5E6F7788UL);

        int startIndex = (request.Page - 1) * request.PageSize + 1;

        for (int i = 0; i < request.PageSize; i++)
        {
            int absoluteIndex = startIndex + i;
            yield return new SongRecord
            {
                Index = absoluteIndex,
                Title = GenerateTitle(locale, contentRng),
                Artist = GenerateArtist(locale, contentRng),
                Album = GenerateAlbum(locale, contentRng),
                Genre = Pick(locale.Genres, contentRng),
                Likes = LikesGenerator.GenerateLikes(request.LikesPerSong, likesRng)
            };
        }
    }

    public SongDetail GenerateDetail(PageRequest request, int recordIndex)
    {
        var locale = _localeData.Get(request.Locale);

        int page = (int)Math.Ceiling((double)recordIndex / request.PageSize);
        int posInPage = (recordIndex - 1) % request.PageSize;

        long pageSeed = CombineSeed(request.Seed, page);
        var contentRng = DeterministicRandom64.Create(pageSeed, 0xC0DEC0DEC0DEC0DEUL);

        string title = "", artist = "", album = "", genre = "";
        for (int i = 0; i <= posInPage; i++)
        {
            title = GenerateTitle(locale, contentRng);
            artist = GenerateArtist(locale, contentRng);
            album = GenerateAlbum(locale, contentRng);
            genre = Pick(locale.Genres, contentRng);
        }

        long likesSeed = CombineSeed(request.Seed ^ 0xDEADBEEFL, page);
        var likesRng = DeterministicRandom64.Create(likesSeed, 0x1A2B3C4D5E6F7788UL);
        int likes = 0;
        for (int i = 0; i <= posInPage; i++)
            likes = LikesGenerator.GenerateLikes(request.LikesPerSong, likesRng);

        long reviewSeed = CombineSeedForRecord(request.Seed, recordIndex);
        var reviewRng = DeterministicRandom64.Create(reviewSeed, 0x99AA22BB33CC44DDUL);
        string review = GenerateReview(locale, reviewRng);

        long audioSeed = CombineSeedForRecord(request.Seed, recordIndex);
        var durationRng = DeterministicRandom64.Create(audioSeed, 0x0A0D10A0D10A0D10UL);
        int bpm = 80 + durationRng.Next(60);
        double beatDuration = 60.0 / bpm;
        double duration = 8 * 4 * beatDuration;
        long lyricsSeed = CombineSeedForRecord(request.Seed ^ 0xBEEFCAFEL, recordIndex);
        var lyricsRng = DeterministicRandom64.Create(lyricsSeed, 0x5555AAAACCCCDDDDUL);
        var lyrics = GenerateLyrics(locale, lyricsRng, duration, title);

        return new SongDetail
        {
            Index = recordIndex,
            Title = title,
            Artist = artist,
            Album = album,
            Genre = genre,
            Likes = likes,
            ReviewText = review,
            AudioSeed = audioSeed,
            DurationSeconds = Math.Round(duration, 2),
            Lyrics = lyrics
        };
    }

    private List<LyricsLine> GenerateLyrics(LocaleDataModel locale, DeterministicRandom64 rng, double duration, string title)
    {
        var lines = new List<LyricsLine>();
        if (locale.LyricsVerbs.Count == 0) return lines;

        double timePerSection = duration / 5.0;
        double lineInterval = timePerSection / 4.0;

        string[] sections = { "verse", "chorus", "verse", "chorus", "outro" };
        double currentTime = 0.5;
        foreach (var section in sections)
        {
            int lineCount = section == "chorus" ? 4 : 3;
            for (int i = 0; i < lineCount; i++)
            {
                string line = section == "chorus"
                    ? GenerateChorusLine(locale, rng, i, title)
                    : GenerateVerseLine(locale, rng);
                lines.Add(new LyricsLine { Text = line, TimeSeconds = Math.Round(currentTime, 2) });
                currentTime += lineInterval * (0.8 + rng.NextDouble() * 0.4);
            }
            currentTime += lineInterval * 0.5;
        }

        return lines;
    }

    private string GenerateVerseLine(LocaleDataModel locale, DeterministicRandom64 rng)
    {
        int pattern = rng.Next(4);
        return pattern switch
        {
            0 => $"{CapFirst(Pick(locale.LyricsVerbs, rng))} into the {Pick(locale.LyricsNouns, rng)} {Pick(locale.LyricsFillers, rng)}",
            1 => $"The {Pick(locale.LyricsAdjectives, rng)} {Pick(locale.LyricsNouns, rng)} calls my name",
            2 => $"I {Pick(locale.LyricsVerbs, rng)} through the {Pick(locale.LyricsAdjectives, rng)} {Pick(locale.LyricsNouns, rng)}",
            _ => $"{Pick(locale.LyricsAdjectives, rng)} {Pick(locale.LyricsNouns, rng)}, {Pick(locale.LyricsFillers, rng)}"
        };
    }

    private string GenerateChorusLine(LocaleDataModel locale, DeterministicRandom64 rng, int lineIdx, string title)
    {
        if (lineIdx == 0)
            return $"{Pick(locale.LyricsChorusStarters, rng)} {Pick(locale.LyricsVerbs, rng)} {Pick(locale.LyricsFillers, rng)}";
        if (lineIdx == 2)
            return $"Oh, {Pick(locale.LyricsNouns, rng)} and {Pick(locale.LyricsNouns, rng)} {Pick(locale.LyricsFillers, rng)}";
        return $"{Pick(locale.LyricsAdjectives, rng)} like the {Pick(locale.LyricsNouns, rng)} {Pick(locale.LyricsFillers, rng)}";
    }

    private string GenerateTitle(LocaleDataModel locale, DeterministicRandom64 rng)
    {
        bool threeWords = rng.NextDouble() < 0.3;
        string adj = Pick(locale.AlbumAdjectives, rng);
        string noun1 = Pick(locale.AlbumNouns, rng);
        if (threeWords)
        {
            string noun2 = Pick(locale.AlbumNouns, rng);
            return $"{adj} {noun1} {noun2}";
        }
        return $"{adj} {noun1}";
    }

    private string GenerateArtist(LocaleDataModel locale, DeterministicRandom64 rng)
    {
        bool isBand = rng.NextDouble() < 0.5;
        if (isBand)
            return $"{Pick(locale.BandPrefixes, rng)} {Pick(locale.BandNouns, rng)}";
        return $"{Pick(locale.FirstNames, rng)} {Pick(locale.LastNames, rng)}";
    }

    private string GenerateAlbum(LocaleDataModel locale, DeterministicRandom64 rng)
    {
        if (rng.NextDouble() < 0.25) return "Single";
        return $"{Pick(locale.AlbumAdjectives, rng)} {Pick(locale.AlbumNouns, rng)}";
    }

    private string GenerateReview(LocaleDataModel locale, DeterministicRandom64 rng)
        => $"{Pick(locale.ReviewPhrases, rng)} {Pick(locale.ReviewConnectors, rng)}.";

    private static T Pick<T>(List<T> list, DeterministicRandom64 rng)
        => list[rng.Next(list.Count)];

    private static string CapFirst(string s)
        => s.Length == 0 ? s : char.ToUpper(s[0]) + s[1..];
}
