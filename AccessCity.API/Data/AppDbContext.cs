using AccessCity.API.Models;
using AccessCity.API.Models.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;

namespace AccessCity.API.Data
{
    public class AppDbContext : IdentityDbContext<AccessCityUser>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<HazardReport> Hazards => Set<HazardReport>();
        public DbSet<InfrastructureAsset> InfrastructureAssets => Set<InfrastructureAsset>();
        public DbSet<FeedIngestionRun> FeedIngestionRuns => Set<FeedIngestionRun>();
        public DbSet<RouteNode> RouteNodes => Set<RouteNode>();
        public DbSet<RouteEdge> RouteEdges => Set<RouteEdge>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            var preferredRoutesConverter = new ValueConverter<List<string>, string>(
                value => JsonSerializer.Serialize(value, JsonSerializerOptions.Default),
                value => string.IsNullOrWhiteSpace(value)
                    ? new List<string>()
                    : JsonSerializer.Deserialize<List<string>>(value, JsonSerializerOptions.Default) ?? new List<string>());

            var preferredRoutesComparer = new ValueComparer<List<string>>(
                (left, right) => left!.SequenceEqual(right!),
                value => value.Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
                value => value.ToList());

            builder.Entity<HazardReport>(entity =>
            {
                entity.ToTable("hazard_reports");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Type).HasMaxLength(50);
                entity.Property(e => e.Description).HasMaxLength(1000);
                entity.Property(e => e.PhotoUrl).HasMaxLength(2048);
                entity.Property(e => e.Source).HasMaxLength(50);
                entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(50);
                entity.Property(e => e.Location).HasColumnType("geometry(Point,4326)");
                entity.HasIndex(e => e.ReportedAt);
            });

            builder.Entity<AccessCityUser>(entity =>
            {
                entity.ToTable("AspNetUsers");
                entity.Property(e => e.FullName).HasMaxLength(150);
                entity.Property(e => e.PreferredRoutes)
                    .HasConversion(preferredRoutesConverter)
                    .HasColumnType("jsonb")
                    .Metadata.SetValueComparer(preferredRoutesComparer);
            });

            builder.Entity<RefreshToken>(entity =>
            {
                entity.ToTable("refresh_tokens");
                entity.Property(e => e.Token).HasMaxLength(400);
                entity.HasOne(d => d.User)
                    .WithMany(p => p.RefreshTokens)
                    .HasForeignKey(d => d.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<InfrastructureAsset>(entity =>
            {
                entity.ToTable("infrastructure_assets");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.AssetType).HasMaxLength(100);
                entity.Property(e => e.Status).HasMaxLength(50);
                entity.Property(e => e.SourceSystem).HasMaxLength(100);
                entity.Property(e => e.SourceRecordId).HasMaxLength(250);
                entity.Property(e => e.Geometry).HasColumnType("geometry(Geometry,4326)");
                entity.Property(e => e.AccessibilityInfo).HasColumnType("jsonb");
                entity.HasIndex(e => new { e.SourceSystem, e.SourceRecordId }).IsUnique();
            });

            builder.Entity<FeedIngestionRun>(entity =>
            {
                entity.ToTable("feed_ingestion_runs");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.SourceType).HasMaxLength(50);
                entity.Property(e => e.SourceName).HasMaxLength(512);
                entity.Property(e => e.Status).HasMaxLength(50);
                entity.Property(e => e.Metadata).HasColumnType("jsonb");
            });

            builder.Entity<RouteNode>(entity =>
            {
                entity.ToTable("route_nodes");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).ValueGeneratedNever();
                entity.Property(e => e.Location).HasColumnType("geometry(Point,4326)");
                entity.Property(e => e.Tags).HasColumnType("jsonb");
            });

            builder.Entity<RouteEdge>(entity =>
            {
                entity.ToTable("route_edges");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Geometry).HasColumnType("geometry(LineString,4326)");
                entity.Property(e => e.SurfaceType).HasMaxLength(50);
                entity.Property(e => e.Tags).HasColumnType("jsonb");
                entity.HasIndex(e => new { e.FromNodeId, e.ToNodeId });
                entity.HasOne(e => e.FromNode)
                    .WithMany()
                    .HasForeignKey(e => e.FromNodeId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.ToNode)
                    .WithMany()
                    .HasForeignKey(e => e.ToNodeId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
