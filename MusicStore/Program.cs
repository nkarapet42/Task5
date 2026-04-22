using MusicStore.Localization;
using Microsoft.EntityFrameworkCore;
using MusicStore.Data;
using MusicStore.Localization;
using MusicStore.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("LookupDb") ?? "Data Source=musicstore.lookup.db"));
builder.Services.AddScoped<ILocaleDataProvider, LocaleDataProvider>();
builder.Services.AddScoped<ISongGeneratorService, SongGeneratorService>();
builder.Services.AddSingleton<IAudioExportService, AudioExportService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    LocaleLookupSeeder.SeedFromJson(db, app.Environment);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthorization();
app.MapControllers();

app.Run();
