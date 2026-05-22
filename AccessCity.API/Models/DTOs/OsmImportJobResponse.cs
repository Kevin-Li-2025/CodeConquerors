namespace AccessCity.API.Models.DTOs;

public sealed record OsmImportJobResponse(
    Guid JobId,
    string Status,
    string FilePath,
    DateTime QueuedAtUtc);
