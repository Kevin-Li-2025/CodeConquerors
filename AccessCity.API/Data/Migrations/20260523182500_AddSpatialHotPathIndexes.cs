using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AccessCity.API.Data.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260523182500_AddSpatialHotPathIndexes")]
    public partial class AddSpatialHotPathIndexes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_route_edges_geometry_gist"
                    ON public.route_edges USING GIST ("Geometry");
                """,
                suppressTransaction: true);

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_route_edges_geometry_geog_gist"
                    ON public.route_edges USING GIST (("Geometry"::geography));
                """,
                suppressTransaction: true);

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_route_nodes_location_gist"
                    ON public.route_nodes USING GIST ("Location");
                """,
                suppressTransaction: true);

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_infrastructure_assets_geometry_gist"
                    ON public.infrastructure_assets USING GIST ("Geometry");
                """,
                suppressTransaction: true);

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_infrastructure_assets_geometry_geog_gist"
                    ON public.infrastructure_assets USING GIST (("Geometry"::geography));
                """,
                suppressTransaction: true);

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_infrastructure_assets_updated_at"
                    ON public.infrastructure_assets ("UpdatedAt" DESC);
                """,
                suppressTransaction: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """DROP INDEX CONCURRENTLY IF EXISTS public."IX_infrastructure_assets_updated_at";""",
                suppressTransaction: true);
            migrationBuilder.Sql(
                """DROP INDEX CONCURRENTLY IF EXISTS public."IX_infrastructure_assets_geometry_geog_gist";""",
                suppressTransaction: true);
            migrationBuilder.Sql(
                """DROP INDEX CONCURRENTLY IF EXISTS public."IX_infrastructure_assets_geometry_gist";""",
                suppressTransaction: true);
            migrationBuilder.Sql(
                """DROP INDEX CONCURRENTLY IF EXISTS public."IX_route_nodes_location_gist";""",
                suppressTransaction: true);
            migrationBuilder.Sql(
                """DROP INDEX CONCURRENTLY IF EXISTS public."IX_route_edges_geometry_geog_gist";""",
                suppressTransaction: true);
            migrationBuilder.Sql(
                """DROP INDEX CONCURRENTLY IF EXISTS public."IX_route_edges_geometry_gist";""",
                suppressTransaction: true);
        }
    }
}
