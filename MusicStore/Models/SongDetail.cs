namespace MusicStore.Models;

public class LyricsLine
{
    public string Text { get; set; } = "";
    public double TimeSeconds { get; set; }
}

public class SongDetail : SongRecord
{
    public string ReviewText { get; set; } = "";
    public long AudioSeed { get; set; }
    public double DurationSeconds { get; set; }
    public List<LyricsLine> Lyrics { get; set; } = new();
}
