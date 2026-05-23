using AccessCity.API.Configuration;
using AccessCity.API.Data;
using AccessCity.API.Messaging;
using AccessCity.API.Models;
using AccessCity.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AccessCity.API.Services;

public interface IOsmImportJobService
{
    Task<OsmImportJobResponse> QueueConfiguredImportAsync(CancellationToken cancellationToken);

    Task<OsmImportJobResponse?> GetImportJobAsync(Guid jobId, CancellationToken cancellationToken);
}

public sealed class OsmImportJobService : IOsmImportJobService
{
    private readonly AppDbContext _dbContext;
    private readonly IMessageBus _messageBus;
    private readonly IOptions<OsmImportOptions> _osmOptions;

    public OsmImportJobService(
        AppDbContext dbContext,
        IMessageBus messageBus,
        IOptions<OsmImportOptions> osmOptions)
    {
        _dbContext = dbContext;
        _messageBus = messageBus;
        _osmOptions = osmOptions;
    }

    public async Task<OsmImportJobResponse> QueueConfiguredImportAsync(CancellationToken cancellationToken)
    {
        var filePath = _osmOptions.Value.FilePath;
        if (string.IsNullOrWhiteSpace(filePath))
        {
            throw new InvalidOperationException("OsmImport:FilePath is not configured.");
        }

        var jobId = Guid.NewGuid();
        var queuedAt = DateTime.UtcNow;
        _dbContext.OsmImportJobs.Add(new OsmImportJob
        {
            Id = jobId,
            Status = "queued",
            FilePath = filePath,
            CityName = "configured",
            QueuedAtUtc = queuedAt
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _messageBus.PublishAsync(
            new OsmImportStartedEvent(jobId, filePath, "configured", queuedAt),
            cancellationToken);

        return new OsmImportJobResponse(jobId, "queued", filePath, queuedAt);
    }

    public async Task<OsmImportJobResponse?> GetImportJobAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await _dbContext.OsmImportJobs.AsNoTracking().SingleOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (job is null)
        {
            return null;
        }

        return new OsmImportJobResponse(
            job.Id,
            job.Status,
            job.FilePath,
            job.QueuedAtUtc,
            job.StartedAtUtc,
            job.FinishedAtUtc,
            job.Attempts,
            job.FeedIngestionRunId,
            job.ErrorSummary);
    }
}
