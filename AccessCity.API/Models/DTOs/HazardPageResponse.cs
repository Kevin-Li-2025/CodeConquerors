using AccessCity.API.Models;

namespace AccessCity.API.Models.DTOs;

public sealed record HazardPageResponse(
    IReadOnlyList<HazardReport> Items,
    string? NextCursor,
    int Limit,
    bool HasMore);
