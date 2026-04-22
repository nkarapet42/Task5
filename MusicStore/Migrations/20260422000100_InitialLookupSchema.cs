using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MusicStore.Migrations;

public partial class InitialLookupSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "LocaleDatasets",
            columns: table => new
            {
                Locale = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                DisplayName = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                PayloadJson = table.Column<string>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_LocaleDatasets", x => x.Locale);
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "LocaleDatasets");
    }
}
