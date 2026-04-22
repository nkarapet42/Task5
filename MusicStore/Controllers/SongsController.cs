using Microsoft.AspNetCore.Mvc;
using MusicStore.Localization;
using MusicStore.Models;
using MusicStore.Services;

namespace MusicStore.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SongsController : ControllerBase
{
    private readonly ISongGeneratorService _generator;
    private readonly ILocaleDataProvider _localeData;

    public SongsController(ISongGeneratorService generator, ILocaleDataProvider localeData)
    {
        _generator = generator;
        _localeData = localeData;
    }

    [HttpGet("locales")]
    public IActionResult GetLocales()
    {
        var locales = _localeData.GetAvailableLocales()
            .Select(l => new { locale = l.locale, displayName = l.displayName });
        return Ok(locales);
    }

    [HttpGet("page")]
    public IActionResult GetPage(
        [FromQuery] string locale = "en-US",
        [FromQuery] long seed = 42,
        [FromQuery] double likesPerSong = 3.0,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;
        likesPerSong = Math.Clamp(likesPerSong, 0, 10);

        var request = new PageRequest
        {
            Locale = locale,
            Seed = seed,
            LikesPerSong = likesPerSong,
            Page = page,
            PageSize = pageSize
        };

        var records = _generator.GeneratePage(request).ToList();
        return Ok(new { page, pageSize, records });
    }

    [HttpGet("detail")]
    public IActionResult GetDetail(
        [FromQuery] string locale = "en-US",
        [FromQuery] long seed = 42,
        [FromQuery] double likesPerSong = 3.0,
        [FromQuery] int recordIndex = 1,
        [FromQuery] int pageSize = 10)
    {
        likesPerSong = Math.Clamp(likesPerSong, 0, 10);
        var request = new PageRequest
        {
            Locale = locale,
            Seed = seed,
            LikesPerSong = likesPerSong,
            PageSize = pageSize
        };
        var detail = _generator.GenerateDetail(request, recordIndex);
        return Ok(detail);
    }

    [HttpGet("export-manifest")]
    public IActionResult GetExportManifest(
        [FromQuery] string locale = "en-US",
        [FromQuery] long seed = 42,
        [FromQuery] double likesPerSong = 3.0,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        likesPerSong = Math.Clamp(likesPerSong, 0, 10);
        var request = new PageRequest
        {
            Locale = locale,
            Seed = seed,
            LikesPerSong = likesPerSong,
            Page = page,
            PageSize = pageSize
        };

        var records = _generator.GeneratePage(request).ToList();
        var manifest = records.Select(r =>
        {
            var detail = _generator.GenerateDetail(request, r.Index);
            return new
            {
                r.Index,
                r.Title,
                r.Artist,
                r.Album,
                r.Genre,
                detail.AudioSeed,
                detail.DurationSeconds,
                FileName = SanitizeFileName($"{r.Title} - {r.Album} - {r.Artist}.wav")
            };
        });

        return Ok(manifest);
    }

    private static string SanitizeFileName(string name)
        => string.Concat(name.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
}
