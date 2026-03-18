namespace AccessCity.API.Exceptions;

/// <summary>
/// Thrown when the Overpass API request fails (timeout, 5xx, network, parse).
/// Caught by exception filter to return 503 with correlation id.
/// </summary>
public class OverpassServiceException : Exception
{
    public OverpassServiceException(string message, Exception? innerException = null)
        : base(message, innerException) { }
}
