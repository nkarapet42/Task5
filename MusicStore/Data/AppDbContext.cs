using Microsoft.EntityFrameworkCore;

namespace MusicStore.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<LocaleDatasetEntity> LocaleDatasets => Set<LocaleDatasetEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var locale = modelBuilder.Entity<LocaleDatasetEntity>();
        locale.ToTable("LocaleDatasets");
        locale.HasKey(x => x.Locale);
        locale.Property(x => x.Locale).HasMaxLength(16);
        locale.Property(x => x.DisplayName).HasMaxLength(128);
        locale.Property(x => x.PayloadJson).HasColumnType("TEXT");
    }
}
