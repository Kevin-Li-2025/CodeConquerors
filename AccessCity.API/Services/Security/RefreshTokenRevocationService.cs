using AccessCity.API.Data;
using Microsoft.EntityFrameworkCore;

namespace AccessCity.API.Services.Security;

public enum RefreshTokenRevokeStatus
{
    Revoked,
    NotFound,
    AlreadyInactive
}

public interface IRefreshTokenRevocationService
{
    Task<RefreshTokenRevokeStatus> RevokeAsync(
        string token,
        string revokedByIp,
        CancellationToken cancellationToken);
}

public sealed class RefreshTokenRevocationService : IRefreshTokenRevocationService
{
    private readonly AppDbContext _dbContext;
    private readonly ITokenService _tokenService;

    public RefreshTokenRevocationService(AppDbContext dbContext, ITokenService tokenService)
    {
        _dbContext = dbContext;
        _tokenService = tokenService;
    }

    public async Task<RefreshTokenRevokeStatus> RevokeAsync(
        string token,
        string revokedByIp,
        CancellationToken cancellationToken)
    {
        var tokenHash = _tokenService.HashRefreshToken(token);
        var refreshToken = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(t => t.Token == tokenHash || t.Token == token, cancellationToken);

        if (refreshToken == null)
        {
            return RefreshTokenRevokeStatus.NotFound;
        }

        if (!refreshToken.IsActive)
        {
            return RefreshTokenRevokeStatus.AlreadyInactive;
        }

        refreshToken.Revoked = DateTime.UtcNow;
        refreshToken.RevokedByIp = revokedByIp;
        refreshToken.ReasonRevoked = "Revoked by user";

        await _dbContext.SaveChangesAsync(cancellationToken);
        return RefreshTokenRevokeStatus.Revoked;
    }
}
