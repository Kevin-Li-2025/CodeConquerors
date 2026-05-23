using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AccessCity.API.Data.Migrations
{
    /// <inheritdoc />
    /// <summary>Speeds up POST /auth/revoke-token (lookup by raw token string).</summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260323120000_AddRefreshTokenIndexOnToken")]
    public partial class AddRefreshTokenIndexOnToken : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE INDEX IF NOT EXISTS "IX_refresh_token_token"
                    ON public.refresh_token (token);
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_refresh_token_token",
                table: "refresh_token");
        }
    }
}
