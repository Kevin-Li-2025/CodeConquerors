namespace AccessCity.API.Messaging;

public record OsmImportStartedEvent(Guid JobId, string FilePath, string CityName, DateTime QueuedAtUtc) : IntegrationEvent;
