using AccessCity.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AccessCity.API.Data;

/// <summary>
/// Bounded-context DbContext for hazard telemetry data (write-heavy).
/// Isolated from Identity and Routing to allow independent database scaling.
/// Falls back to the shared DefaultConnection when HazardDb is not configured.
/// </summary>
public class HazardDbContext : DbContext
{
    public HazardDbContext(DbContextOptions<HazardDbContext> options) : base(options)
    {
    }

    public DbSet<HazardReport> Hazards => Set<HazardReport>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        var isRelational = Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory";

        var hazardStatusConverter = new ValueConverter<HazardStatus, DatabaseHazardStatus>(
            value => ConvertHazardStatusToDb(value),
            value => ConvertHazardStatusFromDb(value));

        var nullableGuidStringConverter = new ValueConverter<string?, Guid?>(
            value => ConvertNullableStringToGuid(value),
            value => ConvertNullableGuidToString(value));

        builder.Entity<HazardReport>(entity =>
        {
            entity.ToTable("hazard_report");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Location).HasColumnName("geom");
            if (isRelational) entity.Property(e => e.Location).HasColumnType("geometry(Point,4326)");

            entity.Property(e => e.Type).HasColumnName("hazard_type");
            if (isRelational) entity.Property(e => e.Type).HasColumnType("text");

            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.PhotoUrl).HasColumnName("photo_url").HasMaxLength(2048);
            entity.Property(e => e.ReportedAt).HasColumnName("reported_at");
            entity.Property(e => e.Source).HasColumnName("source");

            entity.Property(e => e.Status).HasColumnName("status").HasConversion(hazardStatusConverter);
            if (isRelational) entity.Property(e => e.Status).HasColumnType("hazard_status");

            entity.Property(e => e.ReporterUserId)
                .HasColumnName("reporter_user_id")
                .HasConversion(nullableGuidStringConverter);
            if (isRelational) entity.Property(e => e.ReporterUserId).HasColumnType("uuid");

            entity.HasIndex(e => e.ReportedAt).HasDatabaseName("IX_hazard_report_reported_at");
        });

        if (isRelational)
        {
            builder.HasPostgresEnum<DatabaseHazardStatus>("hazard_status");
        }
    }

    private static DatabaseHazardStatus ConvertHazardStatusToDb(HazardStatus value) => value switch
    {
        HazardStatus.Reported => DatabaseHazardStatus.Reported,
        HazardStatus.Acknowledged => DatabaseHazardStatus.Verified,
        HazardStatus.UnderReview => DatabaseHazardStatus.UnderReview,
        HazardStatus.Resolved => DatabaseHazardStatus.Resolved,
        HazardStatus.Dismissed => DatabaseHazardStatus.Rejected,
        _ => DatabaseHazardStatus.Reported
    };

    private static HazardStatus ConvertHazardStatusFromDb(DatabaseHazardStatus value) => value switch
    {
        DatabaseHazardStatus.Reported => HazardStatus.Reported,
        DatabaseHazardStatus.UnderReview => HazardStatus.UnderReview,
        DatabaseHazardStatus.Verified => HazardStatus.Acknowledged,
        DatabaseHazardStatus.ActionPlanned => HazardStatus.UnderReview,
        DatabaseHazardStatus.InProgress => HazardStatus.UnderReview,
        DatabaseHazardStatus.Resolved => HazardStatus.Resolved,
        DatabaseHazardStatus.Rejected => HazardStatus.Dismissed,
        DatabaseHazardStatus.Duplicate => HazardStatus.Dismissed,
        _ => HazardStatus.Reported
    };

    private static Guid? ConvertNullableStringToGuid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return Guid.Parse(value);
    }

    private static string? ConvertNullableGuidToString(Guid? value)
    {
        return value.HasValue ? value.Value.ToString() : null;
    }
}
