using AccessCity.API.Models.Identity;

namespace AccessCity.API.Models;

public sealed class SupportContactSubmission
{
    public Guid Id { get; set; }
    public string? UserId { get; set; }
    public AccessCityUser? User { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "general";
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = "open";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
