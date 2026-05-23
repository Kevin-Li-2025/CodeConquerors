using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Asp.Versioning;
using AccessCity.API.Common;
using AccessCity.API.Hubs;
using AccessCity.API.Models;
using AccessCity.API.Models.DTOs;
using AccessCity.API.Services;

namespace AccessCity.API.Controllers;

/// <summary>
/// CRUD operations for hazard reports with real-time SignalR broadcasting.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class HazardsController : ControllerBase
{
    private readonly IHazardReportService _hazards;
    private readonly IHubContext<HazardAlertHub> _alertHub;

    public HazardsController(
        IHazardReportService hazards,
        IHubContext<HazardAlertHub> alertHub)
    {
        _hazards = hazards;
        _alertHub = alertHub;
    }

    /// <summary>
    /// Lists hazard reports, optionally filtered by bounding box and status.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<HazardReport>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<HazardReport>>> GetHazards(
        [FromQuery] double? minLat,
        [FromQuery] double? minLng,
        [FromQuery] double? maxLat,
        [FromQuery] double? maxLng,
        [FromQuery] HazardStatus? status,
        CancellationToken cancellationToken = default)
    {
        var hazards = await _hazards.GetHazardsAsync(minLat, minLng, maxLat, maxLng, status, cancellationToken);
        return Ok(hazards);
    }

    /// <summary>
    /// Creates a new hazard report and broadcasts a real-time alert via SignalR.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(HazardReport), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<HazardReport>> ReportHazard(
        [FromBody] CreateHazardRequest request,
        CancellationToken cancellationToken = default)
    {
        var report = await _hazards.CreateAsync(request, cancellationToken);

        // Broadcast real-time alert to connected clients
        await _alertHub.Clients.All.SendAsync("HazardReported", new RouteAlert(
            report.Type, report.Description,
            report.Location.Y, report.Location.X, report.ReportedAt), cancellationToken);

        return CreatedAtAction(nameof(GetHazardById), new { id = report.Id }, report);
    }

    /// <summary>
    /// Retrieves a single hazard report by ID, falling back to OSM-backed synthetic hazards.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(HazardReport), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HazardReport>> GetHazardById(Guid id, CancellationToken cancellationToken = default)
    {
        var hazard = await _hazards.GetByIdAsync(id, cancellationToken);
        return hazard is null ? NotFound() : Ok(hazard);
    }

    /// <summary>
    /// Updates the status of an existing hazard report.
    /// </summary>
    [HttpPatch("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateHazardStatus(Guid id, [FromBody] HazardStatus status, CancellationToken cancellationToken = default)
    {
        var hazard = await _hazards.UpdateStatusAsync(id, status, cancellationToken);
        if (hazard is null)
            return NotFound();

        return NoContent();
    }
}
