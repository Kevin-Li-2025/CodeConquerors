using System.Globalization;
using System.Text.Json;
using AccessCity.API.Common;
using AccessCity.API.Configuration;
using AccessCity.API.Models;
using AccessCity.API.Services;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace AccessCity.API.Controllers;

/// <summary>
/// AI-assist endpoints that format text, review candidates, and explanations without influencing route decisions.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/ai-assist")]
public sealed class AiAssistController : ControllerBase
{
    private readonly IHazardReportService _hazards;
    private readonly IAiAssistService _aiAssist;
    private readonly IAccessibilityVerificationService _accessibilityVerifications;
    private readonly IAccessibilityAiInferenceService _accessibilityInference;
    private readonly AiEnrichmentOptions _options;

    public AiAssistController(
        IHazardReportService hazards,
        IAiAssistService aiAssist,
        IAccessibilityVerificationService accessibilityVerifications,
        IAccessibilityAiInferenceService accessibilityInference,
        IOptions<AiEnrichmentOptions> options)
    {
        _hazards = hazards;
        _aiAssist = aiAssist;
        _accessibilityVerifications = accessibilityVerifications;
        _accessibilityInference = accessibilityInference;
        _options = options.Value;
    }

    /// <summary>
    /// Normalizes a hazard report and returns duplicate and missing OSM attribute review candidates.
    /// </summary>
    [HttpGet("hazards/{id:guid}/enrichment")]
    [ProducesResponseType(typeof(HazardAiEnrichmentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HazardAiEnrichmentResult>> GetHazardEnrichment(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiError("AI assist is disabled."));
        }

        var hazard = await _hazards.GetByIdAsync(id, cancellationToken);
        if (hazard is null)
        {
            return NotFound(new ApiError("Hazard not found."));
        }

        var nearby = await GetNearbyHazardsAsync(hazard, cancellationToken);
        var enrichment = await _aiAssist.EnrichHazardAsync(hazard, nearby, cancellationToken);
        return Ok(enrichment);
    }

    /// <summary>
    /// Explains an already-computed route. This endpoint does not compute or alter routes.
    /// </summary>
    [HttpPost("route-explanation")]
    [ProducesResponseType(typeof(RouteExplanationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<RouteExplanationResponse>> ExplainRoute(
        [FromBody] JsonElement requestPayload,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiError("AI assist is disabled."));
        }

        var request = BuildRouteExplanationRequest(requestPayload);
        var explanation = await _aiAssist.ExplainRouteAsync(request, cancellationToken);
        return Ok(explanation);
    }

    /// <summary>
    /// Reviews a structured accessibility profile and returns human-verification suggestions.
    /// The result is advisory only and never updates routing decisions.
    /// </summary>
    [HttpGet("infrastructure/{assetId:long}/accessibility-review")]
    [ProducesResponseType(typeof(AccessibilityAiReviewResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AccessibilityAiReviewResult>> GetAccessibilityReview(
        long assetId,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiError("AI assist is disabled."));
        }

        var profile = await _accessibilityVerifications.GetProfileAsync(assetId, cancellationToken);
        if (profile is null)
        {
            return NotFound(new ApiError("Infrastructure asset not found."));
        }

        var review = await _aiAssist.ReviewAccessibilityProfileAsync(assetId, profile, cancellationToken);
        return Ok(review);
    }

    /// <summary>
    /// Generates accessibility attribute candidates from field text/photos and current profile gaps.
    /// This endpoint is outside routing hot paths and returns review-only suggestions.
    /// </summary>
    [Authorize]
    [HttpPost("infrastructure/{assetId:long}/accessibility-candidates")]
    [ProducesResponseType(typeof(AccessibilityAiInferenceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AccessibilityAiInferenceResult>> GenerateAccessibilityCandidates(
        long assetId,
        [FromBody] AccessibilityAiInferenceRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiError("AI assist is disabled."));
        }

        var profile = await _accessibilityVerifications.GetProfileAsync(assetId, cancellationToken);
        if (profile is null)
        {
            return NotFound(new ApiError("Infrastructure asset not found."));
        }

        var result = await _accessibilityInference.InferAsync(assetId, profile, request, cancellationToken);
        return Ok(result);
    }

    private static RouteExplanationRequest BuildRouteExplanationRequest(JsonElement payload)
    {
        var routeRequestElement = TryGetProperty(payload, "routeRequest");
        var routeElement = TryGetProperty(payload, "route");

        return new RouteExplanationRequest
        {
            RouteRequest = new RouteRequest
            {
                Profile = GetString(routeRequestElement, "profile") ?? "standard",
                SafetyWeight = GetDouble(routeRequestElement, "safetyWeight") ?? 0.5,
                Preferences = GetStringArray(routeRequestElement, "preferences")
            },
            Route = new RouteResponse
            {
                Distance = GetDouble(routeElement, "distance") ?? 0,
                EstimatedTime = GetDouble(routeElement, "estimatedTime") ?? 0,
                SafetyScore = GetDouble(routeElement, "safetyScore") ?? 0,
                Warnings = GetStringArray(routeElement, "warnings")
            }
        };
    }

    private static JsonElement? TryGetProperty(JsonElement? element, string propertyName)
    {
        if (element is null || element.Value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var property in element.Value.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                return property.Value;
            }
        }

        return null;
    }

    private static string? GetString(JsonElement? element, string propertyName)
    {
        var property = TryGetProperty(element, propertyName);
        return property?.ValueKind == JsonValueKind.String
            ? property.Value.GetString()
            : null;
    }

    private static double? GetDouble(JsonElement? element, string propertyName)
    {
        var property = TryGetProperty(element, propertyName);
        if (property is null)
        {
            return null;
        }

        if (property.Value.ValueKind == JsonValueKind.Number && property.Value.TryGetDouble(out var number))
        {
            return number;
        }

        if (property.Value.ValueKind == JsonValueKind.String
            && double.TryParse(property.Value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out number))
        {
            return number;
        }

        return null;
    }

    private static List<string> GetStringArray(JsonElement? element, string propertyName)
    {
        var property = TryGetProperty(element, propertyName);
        if (property?.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return property.Value.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.String)
            .Select(item => item.GetString())
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .ToList();
    }

    private async Task<IReadOnlyCollection<HazardReport>> GetNearbyHazardsAsync(
        HazardReport hazard,
        CancellationToken cancellationToken)
    {
        var radiusMetres = Math.Max(1, _options.DuplicateRadiusMetres);
        var latDelta = radiusMetres / 111_320d;
        var cosLat = Math.Cos(hazard.Location.Y * Math.PI / 180);
        var lngDelta = Math.Abs(cosLat) < 0.01 ? latDelta : radiusMetres / (111_320d * Math.Abs(cosLat));

        return await _hazards.GetHazardsAsync(
            hazard.Location.Y - latDelta,
            hazard.Location.X - lngDelta,
            hazard.Location.Y + latDelta,
            hazard.Location.X + lngDelta,
            null,
            cancellationToken);
    }
}
