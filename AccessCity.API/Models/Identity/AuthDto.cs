using System.ComponentModel.DataAnnotations;

namespace AccessCity.API.Models.Identity
{
    public record LoginRequest(
        [Required, EmailAddress] string Email,
        [Required] string Password
    );

    public record RegisterRequest(
        [Required, EmailAddress] string Email,
        [Required, MinLength(8)] string Password,
        [Required] string FullName
    );

    public record AuthResponse(
        string Token,
        string RefreshToken,
        string Email,
        string FullName
    );
}
