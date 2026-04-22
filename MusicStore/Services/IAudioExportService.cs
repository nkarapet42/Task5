namespace MusicStore.Services;

public interface IAudioExportService
{
    byte[] RenderSongMp3(long audioSeed, double durationSeconds);
    byte[] BuildExportZip(IEnumerable<(string FileName, long AudioSeed, double DurationSeconds)> songs);
}
