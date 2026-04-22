using MusicStore.Models;

namespace MusicStore.Services;

public interface ISongGeneratorService
{
    IEnumerable<SongRecord> GeneratePage(PageRequest request);
    SongDetail GenerateDetail(PageRequest request, int recordIndex);
}
