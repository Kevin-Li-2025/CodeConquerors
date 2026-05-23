using AccessCity.API.Common;
using AccessCity.API.Models;
using AccessCity.API.Services;
using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;

namespace AccessCity.API.Controllers;

/// <summary>
/// Spatial queries: points of interest (PostGIS proximity) and themed map overlays.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class SpatialController : ControllerBase
{
    private readonly ISpatialQueryService _spatialQueries;

    public SpatialController(ISpatialQueryService spatialQueries)
    {
        _spatialQueries = spatialQueries;
    }

    /// <summary>
    /// Returns points of interest within a radius of the given coordinate, ordered by proximity.
    /// </summary>
    [HttpGet("poi")]
    [ProducesResponseType(typeof(IEnumerable<PointOfInterest>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IEnumerable<PointOfInterest>>> GetPointsOfInterest(
        [FromQuery] double lat,
        [FromQuery] double lng,
        [FromQuery] double radius = 1000,
        CancellationToken cancellationToken = default)
    {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
        {
            return BadRequest(new ApiError("Invalid coordinates."));
        }

        if (radius <= 0 || radius > 10000)
        {
            return BadRequest(new ApiError("Radius must be between 1 and 10000 metres."));
        }

        var points = await _spatialQueries.GetPointsOfInterestAsync(lat, lng, radius, cancellationToken);
        return Ok(points);
    }

    /// <summary>
    /// Returns a themed map overlay (hazards or infrastructure) as a list of spatial features.
    /// </summary>
    [HttpGet("map-overlay")]
    [ProducesResponseType(typeof(MapOverlayResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetMapOverlay(
        [FromQuery] string layerName,
        CancellationToken cancellationToken = default)
    {
        var overlay = await _spatialQueries.GetMapOverlayAsync(layerName, cancellationToken);
        return overlay is null
            ? BadRequest(new ApiError("Supported layers: hazards, infrastructure."))
            : Ok(overlay);
    }
}
