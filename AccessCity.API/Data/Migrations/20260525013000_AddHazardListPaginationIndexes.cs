using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AccessCity.API.Data.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260525013000_AddHazardListPaginationIndexes")]
    public partial class AddHazardListPaginationIndexes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_hazard_report_status_reported_at_desc"
                    ON public.hazard_report (status, reported_at DESC);
                """,
                suppressTransaction: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP INDEX CONCURRENTLY IF EXISTS public."IX_hazard_report_status_reported_at_desc";
                """,
                suppressTransaction: true);
        }
    }
}
