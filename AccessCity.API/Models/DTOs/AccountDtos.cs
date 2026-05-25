using System.ComponentModel.DataAnnotations;

namespace AccessCity.API.Models.DTOs;

public sealed record AccessibilityPreferenceDto(
    string MobilityDevice,
    bool AvoidStairs,
    bool AvoidSteepIncline,
    bool PreferCurbRamps,
    bool PreferSmoothSurface,
    int MaxDetourToleranceMinutes);

public sealed record AccountProfileResponse(
    string Email,
    string FullName,
    AccessibilityPreferenceDto AccessibilityPreferences,
    AccountProfileStatsDto Stats);

public sealed record AccountProfileStatsDto(
    int ReportsSubmitted,
    int ResolvedReports,
    int CommunityImpact);

public sealed record UpdateAccountProfileRequest(
    [property: MaxLength(150)] string? FullName,
    AccessibilityPreferenceDto? AccessibilityPreferences);

public sealed record NotificationSettingsDto(
    bool HazardAlerts,
    bool RouteWarnings,
    bool ReportUpdates,
    bool WeeklySummary);

public sealed record SupportContactRequest(
    [property: Required, MaxLength(160)] string Subject,
    [property: Required, MaxLength(4000)] string Message,
    [property: MaxLength(80)] string? Category);

public sealed record SupportContactResponse(
    Guid Id,
    string Status,
    DateTime CreatedAtUtc);

public sealed record HazardPhotoUploadResponse(
    Guid HazardId,
    string PhotoUrl,
    long SizeBytes,
    string ContentType);
