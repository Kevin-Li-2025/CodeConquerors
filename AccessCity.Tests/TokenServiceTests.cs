using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AccessCity.API.Models.Identity;
using AccessCity.API.Services.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace AccessCity.Tests;

/// <summary>
/// Unit tests for <see cref="TokenService"/>. Uses in-memory configuration —
/// no external dependencies, fully deterministic.
/// </summary>
public class TokenServiceTests
{
    private const string TestSecret = "ThisIsATestSecretKeyForJwtTokenGeneration_MinLength32";

    private static IConfiguration BuildConfig(
        string key = TestSecret,
        string issuer = "AccessCity.API.Test",
        string audience = "AccessCity.App.Test",
        string expirationMinutes = "15",
        string refreshDays = "7")
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = key,
                ["Jwt:Issuer"] = issuer,
                ["Jwt:Audience"] = audience,
                ["Jwt:AccessTokenExpirationMinutes"] = expirationMinutes,
                ["Jwt:RefreshTokenExpirationDays"] = refreshDays,
            })
            .Build();
    }

    private static AccessCityUser MakeUser(string? email = null) => new()
    {
        Id = Guid.NewGuid().ToString(),
        Email = email ?? "test@example.com",
        UserName = email ?? "test@example.com",
        FullName = "Test User"
    };

    // ─────────── Access Token ───────────

    [Fact]
    public void CreateToken_ReturnsValidJwt()
    {
        var svc = new TokenService(BuildConfig());
        var user = MakeUser();

        string token = svc.CreateToken(user);

        Assert.False(string.IsNullOrWhiteSpace(token));
        var handler = new JwtSecurityTokenHandler();
        Assert.True(handler.CanReadToken(token));
    }

    [Fact]
    public void CreateToken_ContainsExpectedClaims()
    {
        var svc = new TokenService(BuildConfig());
        var user = MakeUser("alice@example.com");

        string token = svc.CreateToken(user);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        Assert.Equal(user.Id, jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.NameId).Value);
        Assert.Equal("alice@example.com", jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Email).Value);
        Assert.NotNull(jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Jti));
    }

    [Fact]
    public void CreateToken_HasCorrectIssuerAndAudience()
    {
        var svc = new TokenService(BuildConfig());
        var token = svc.CreateToken(MakeUser());

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("AccessCity.API.Test", jwt.Issuer);
        Assert.Contains("AccessCity.App.Test", jwt.Audiences);
    }

    [Fact]
    public void CreateToken_ExpiresInConfiguredTime()
    {
        var svc = new TokenService(BuildConfig(expirationMinutes: "30"));
        var before = DateTime.UtcNow;
        var token = svc.CreateToken(MakeUser());
        var after = DateTime.UtcNow;

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        // Token should expire ~30 minutes from now (±5s tolerance)
        Assert.InRange(jwt.ValidTo, before.AddMinutes(29), after.AddMinutes(31));
    }

    [Fact]
    public void CreateToken_IsVerifiableWithSigningKey()
    {
        var config = BuildConfig();
        var svc = new TokenService(config);
        var token = svc.CreateToken(MakeUser());

        var handler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(TestSecret));

        var principal = handler.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "AccessCity.API.Test",
            ValidateAudience = true,
            ValidAudience = "AccessCity.App.Test",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(10),
        }, out SecurityToken validatedToken);

        Assert.NotNull(principal);
        Assert.NotNull(validatedToken);
    }

    [Fact]
    public void CreateToken_DifferentUsers_ProduceDifferentTokens()
    {
        var svc = new TokenService(BuildConfig());
        string t1 = svc.CreateToken(MakeUser("a@b.com"));
        string t2 = svc.CreateToken(MakeUser("c@d.com"));
        Assert.NotEqual(t1, t2);
    }

    // ─────────── Refresh Token ───────────

    [Fact]
    public void GenerateRefreshToken_ReturnsNonEmptyToken()
    {
        var svc = new TokenService(BuildConfig());
        var rt = svc.GenerateRefreshToken("127.0.0.1");

        Assert.False(string.IsNullOrWhiteSpace(rt.Token));
        Assert.True(rt.Token.Length > 20, "Refresh token should be cryptographically long");
        Assert.StartsWith("sha256:", rt.Entity.Token);
        Assert.NotEqual(rt.Token, rt.Entity.Token);
    }

    [Fact]
    public void GenerateRefreshToken_ExpiresInConfiguredDays()
    {
        var svc = new TokenService(BuildConfig(refreshDays: "14"));
        var before = DateTime.UtcNow;
        var rt = svc.GenerateRefreshToken("10.0.0.1");

        Assert.InRange(rt.Entity.Expires, before.AddDays(13), before.AddDays(15));
    }

    [Fact]
    public void GenerateRefreshToken_RecordsCreatorIp()
    {
        var svc = new TokenService(BuildConfig());
        var rt = svc.GenerateRefreshToken("192.168.1.1");
        Assert.Equal("192.168.1.1", rt.Entity.CreatedByIp);
    }

    [Fact]
    public void GenerateRefreshToken_EachCallIsUnique()
    {
        var svc = new TokenService(BuildConfig());
        var t1 = svc.GenerateRefreshToken("127.0.0.1");
        var t2 = svc.GenerateRefreshToken("127.0.0.1");
        Assert.NotEqual(t1.Token, t2.Token);
        Assert.NotEqual(t1.Entity.Token, t2.Entity.Token);
    }

    [Fact]
    public void HashRefreshToken_IsStable_And_DoesNotExposeRawToken()
    {
        var svc = new TokenService(BuildConfig());
        const string raw = "refresh-token-value";

        var first = svc.HashRefreshToken(raw);
        var second = svc.HashRefreshToken(raw);

        Assert.Equal(first, second);
        Assert.StartsWith("sha256:", first);
        Assert.DoesNotContain(raw, first);
    }

    // ─────────── Error handling ───────────

    [Fact]
    public void Constructor_MissingJwtKey_Throws()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = null })
            .Build();

        Assert.Throws<InvalidOperationException>(() => new TokenService(config));
    }
}
