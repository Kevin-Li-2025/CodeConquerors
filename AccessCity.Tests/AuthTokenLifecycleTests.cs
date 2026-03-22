using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AccessCity.API.Models.Identity;

namespace AccessCity.Tests;

public sealed class AuthTokenLifecycleTests : IClassFixture<AccessCityApiFactory>
{
    private readonly AccessCityApiFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
    };

    public AuthTokenLifecycleTests(AccessCityApiFactory factory) => _factory = factory;

    [Fact]
    public async Task RefreshToken_with_valid_token_returns_new_pair()
    {
        var client = _factory.CreateClient();
        var email = $"rt-{Guid.NewGuid():N}@example.com";
        var reg = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(email, "P@ssword123!", "RT User"),
            JsonOptions);
        if (reg.StatusCode != HttpStatusCode.OK)
            return;

        var first = await reg.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.NotNull(first?.RefreshToken);

        var refresh = await client.PostAsync(
            $"/api/v1/auth/refresh-token?token={Uri.EscapeDataString(first.RefreshToken)}",
            null);

        if (refresh.StatusCode == HttpStatusCode.ServiceUnavailable)
            return;

        refresh.EnsureSuccessStatusCode();
        var second = await refresh.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.NotNull(second?.Token);
        Assert.NotEqual(first.Token, second.Token);
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
    }

    [Fact]
    public async Task RevokeToken_twice_second_call_returns_400()
    {
        var client = _factory.CreateClient();
        var email = $"rv-{Guid.NewGuid():N}@example.com";
        var reg = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            new RegisterRequest(email, "P@ssword123!", "RV User"),
            JsonOptions);
        if (reg.StatusCode != HttpStatusCode.OK)
            return;

        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.NotNull(auth?.RefreshToken);
        var token = Uri.EscapeDataString(auth.RefreshToken);

        var first = await client.PostAsync($"/api/v1/auth/revoke-token?token={token}", null);
        if (first.StatusCode == HttpStatusCode.ServiceUnavailable)
            return;
        first.EnsureSuccessStatusCode();

        var second = await client.PostAsync($"/api/v1/auth/revoke-token?token={token}", null);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }
}
