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
    /// Previews AI-assisted hazard intake before a report is persisted.
    /// The response can normalize text and suggest duplicate review, but cannot create or alter routes.
    /// </summary>
    [HttpPost("hazards/report-draft")]
    [ProducesResponseType(typeof(HazardReportDraftAiResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HazardReportDraftAiResult>> PreviewHazardReportDraft(
        [FromBody] HazardReportDraftAiRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiError("AI assist is disabled."));
        }

        if (!IsValidLatitude(request.Latitude) || !IsValidLongitude(request.Longitude))
        {
            return BadRequest(new ApiError("A valid report latitude and longitude are required."));
        }

        if (string.IsNullOrWhiteSpace(request.Type) && string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new ApiError("A hazard type or description is required."));
        }

        var nearby = await GetNearbyPersistedHazardsAsync(request.Latitude, request.Longitude, cancellationToken);
        var preview = await _aiAssist.PreviewHazardReportDraftAsync(request, nearby, cancellationToken);
        return Ok(preview);
    }

    /// <summary>
    /// Analyzes a hazard field photo for review-only accessibility attribute candidates.
    /// This endpoint is outside routing hot paths and cannot update route costs.
    /// </summary>
    [HttpPost("hazards/{id:guid}/photo-analysis")]
    [ProducesResponseType(typeof(HazardPhotoAiAnalysisResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HazardPhotoAiAnalysisResult>> AnalyzeHazardPhoto(
        Guid id,
        [FromBody] HazardPhotoAiAnalysisRequest? request,
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

        var photoUrl = string.IsNullOrWhiteSpace(request?.PhotoUrl)
            ? hazard.PhotoUrl
            : request.PhotoUrl.Trim();
        if (string.IsNullOrWhiteSpace(photoUrl))
        {
            return BadRequest(new ApiError("A hazard photo URL is required for photo analysis."));
        }

        var absolutePhotoUrl = ResolveAbsolutePhotoUrl(photoUrl);
        var inference = await _accessibilityInference.InferAsync(
            assetId: 0,
            BuildHazardPhotoReviewProfile(hazard),
            new AccessibilityAiInferenceRequest
            {
                ObservationText = BuildHazardPhotoObservation(hazard, request?.ObservationText),
                Photos =
                [
                    new AccessibilityPhotoInput
                    {
                        Source = "hazard_photo",
                        Url = absolutePhotoUrl,
                        Caption = BuildHazardPhotoCaption(hazard),
                        TakenAtUtc = hazard.ReportedAt
                    }
                ],
                IncludeDraftVerification = request?.IncludeDraftVerification ?? true
            },
            cancellationToken);

        return Ok(ToHazardPhotoAnalysisResult(hazard.Id, absolutePhotoUrl, inference));
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
        return await GetNearbyHazardsAsync(hazard.Location.Y, hazard.Location.X, cancellationToken);
    }

    private async Task<IReadOnlyCollection<HazardReport>> GetNearbyHazardsAsync(
        double latitude,
        double longitude,
        CancellationToken cancellationToken)
    {
        var (minLat, minLng, maxLat, maxLng) = BuildNearbyBounds(latitude, longitude);

        return await _hazards.GetHazardsAsync(
            minLat,
            minLng,
            maxLat,
            maxLng,
            null,
            cancellationToken);
    }

    private async Task<IReadOnlyCollection<HazardReport>> GetNearbyPersistedHazardsAsync(
        double latitude,
        double longitude,
        CancellationToken cancellationToken)
    {
        var (minLat, minLng, maxLat, maxLng) = BuildNearbyBounds(latitude, longitude);
        return await _hazards.GetPersistedHazardsAsync(
            minLat,
            minLng,
            maxLat,
            maxLng,
            null,
            limit: 25,
            cancellationToken);
    }

    private (double MinLat, double MinLng, double MaxLat, double MaxLng) BuildNearbyBounds(
        double latitude,
        double longitude)
    {
        var radiusMetres = Math.Max(1, _options.DuplicateRadiusMetres);
        var latDelta = radiusMetres / 111_320d;
        var cosLat = Math.Cos(latitude * Math.PI / 180);
        var lngDelta = Math.Abs(cosLat) < 0.01 ? latDelta : radiusMetres / (111_320d * Math.Abs(cosLat));

        return (
            latitude - latDelta,
            longitude - lngDelta,
            latitude + latDelta,
            longitude + lngDelta);
    }

    private static bool IsValidLatitude(double latitude) =>
        !double.IsNaN(latitude) && !double.IsInfinity(latitude) && latitude is >= -90 and <= 90;

    private static bool IsValidLongitude(double longitude) =>
        !double.IsNaN(longitude) && !double.IsInfinity(longitude) && longitude is >= -180 and <= 180;

    private static InfrastructureAccessibilityProfile BuildHazardPhotoReviewProfile(HazardReport hazard)
    {
        return new InfrastructureAccessibilityProfile
        {
            SourceSystem = "hazard_report",
            SourceRecordId = hazard.Id.ToString("D"),
            ProfileGeneratedAtUtc = DateTime.UtcNow,
            VerificationStatus = "hazard-photo-review",
            Confidence = 0.2,
            MissingFields =
            [
                "surface",
                "smoothness",
                "width_metres",
                "kerb",
                "curb_ramp",
                "incline_percent",
                "tactile_paving",
                "last_verified_at"
            ],
            EvidenceTags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["hazard_type"] = hazard.Type,
                ["hazard_status"] = hazard.Status.ToString()
            }
        };
    }

    private static string BuildHazardPhotoObservation(HazardReport hazard, string? observationText)
    {
        var supplied = string.IsNullOrWhiteSpace(observationText)
            ? string.Empty
            : observationText.Trim();
        return string.Join(
            "\n",
            new[]
            {
                $"Hazard type: {hazard.Type}",
                $"Hazard description: {hazard.Description}",
                $"Hazard status: {hazard.Status}",
                supplied.Length > 0 ? $"Reporter observation: {supplied}" : null
            }.Where(part => !string.IsNullOrWhiteSpace(part)));
    }

    private static string BuildHazardPhotoCaption(HazardReport hazard) =>
        $"Field photo for {hazard.Type} hazard reported at {hazard.ReportedAt:O}.";

    private string ResolveAbsolutePhotoUrl(string photoUrl)
    {
        if (Uri.TryCreate(photoUrl, UriKind.Absolute, out var absolute)
            && (absolute.Scheme == Uri.UriSchemeHttp || absolute.Scheme == Uri.UriSchemeHttps))
        {
            return absolute.ToString();
        }

        var path = photoUrl.StartsWith("/", StringComparison.Ordinal)
            ? photoUrl
            : "/" + photoUrl;
        var pathBase = Request.PathBase.HasValue ? Request.PathBase.Value : string.Empty;
        return $"{Request.Scheme}://{Request.Host}{pathBase}{path}";
    }

    private static HazardPhotoAiAnalysisResult ToHazardPhotoAnalysisResult(
        Guid hazardId,
        string photoUrl,
        AccessibilityAiInferenceResult inference)
    {
        return new HazardPhotoAiAnalysisResult
        {
            HazardId = hazardId,
            ForRouteDecision = false,
            Provider = inference.Provider,
            Model = inference.Model,
            GeneratedAtUtc = inference.GeneratedAtUtc,
            PhotoUrl = photoUrl,
            ReviewStatus = inference.AttributeCandidates.Count > 0 ? "review_required" : "no_candidates",
            AdminSummary = inference.AdminSummary,
            AttributeCandidates = inference.AttributeCandidates,
            DraftVerification = inference.DraftVerification,
            Guardrails = inference.Guardrails,
            Limitations = inference.Limitations
        };
    }
}
