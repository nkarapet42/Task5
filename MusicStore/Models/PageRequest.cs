namespace MusicStore.Models;

public class PageRequest
{
    public string Locale { get; set; } = "en-US";
    public long Seed { get; set; } = 42;
    public double LikesPerSong { get; set; } = 3.0;
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
