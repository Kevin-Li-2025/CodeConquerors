using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AccessCity.Tests;

public sealed class AccountEndpointsTests : IClassFixture<AccessCityApiFactory>
{
    private readonly AccessCityApiFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
    };

    public AccountEndpointsTests(AccessCityApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Account_profile_defaults_are_wheelchair_safe_for_new_users()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync("/api/v1/account/profile");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        var preferences = json.GetProperty("accessibilityPreferences");

        Assert.Equal("Manual wheelchair", preferences.GetProperty("mobilityDevice").GetString());
        Assert.True(preferences.GetProperty("avoidStairs").GetBoolean());
        Assert.True(preferences.GetProperty("avoidSteepIncline").GetBoolean());
        Assert.True(preferences.GetProperty("preferCurbRamps").GetBoolean());
        Assert.True(preferences.GetProperty("preferSmoothSurface").GetBoolean());
        Assert.Equal(30, preferences.GetProperty("maxDetourToleranceMinutes").GetInt32());
    }

    [Fact]
    public async Task Account_profile_can_be_read_and_updated()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var update = await client.PutAsJsonAsync("/api/v1/account/profile", new
        {
            fullName = "Updated AccessCity User",
            accessibilityPreferences = new
            {
                mobilityDevice = "Stroller",
                avoidStairs = true,
                avoidSteepIncline = false,
                preferCurbRamps = true,
                preferSmoothSurface = true,
                maxDetourToleranceMinutes = 20
            }
        }, JsonOptions);

        update.EnsureSuccessStatusCode();
        var json = await update.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        Assert.Equal("Updated AccessCity User", json.GetProperty("fullName").GetString());
        Assert.Equal("Stroller", json.GetProperty("accessibilityPreferences").GetProperty("mobilityDevice").GetString());

        var get = await client.GetAsync("/api/v1/account/profile");
        get.EnsureSuccessStatusCode();
        var getJson = await get.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        Assert.Equal("Updated AccessCity User", getJson.GetProperty("fullName").GetString());
    }

    [Fact]
    public async Task Notifications_round_trip_through_account_api()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var update = await client.PutAsJsonAsync("/api/v1/account/notifications", new
        {
            hazardAlerts = false,
            routeWarnings = true,
            reportUpdates = true,
            weeklySummary = true
        }, JsonOptions);
        update.EnsureSuccessStatusCode();

        var get = await client.GetAsync("/api/v1/account/notifications");
        get.EnsureSuccessStatusCode();
        var json = await get.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        Assert.False(json.GetProperty("hazardAlerts").GetBoolean());
        Assert.True(json.GetProperty("weeklySummary").GetBoolean());
    }

    [Fact]
    public async Task Support_contact_creates_ticket_for_authenticated_user()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/v1/account/support/contact", new
        {
            subject = "Route feedback",
            message = "The wheelchair route looks wrong near the station entrance.",
            category = "app-support"
        }, JsonOptions);

        var responseBody = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, responseBody);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        Assert.Equal("open", json.GetProperty("status").GetString());
        Assert.True(Guid.TryParse(json.GetProperty("id").GetString(), out _));
    }

    [Fact]
    public async Task OAuth_provider_discovery_is_public_and_authorize_requires_config()
    {
        var client = _factory.CreateClient();

        var providers = await client.GetAsync("/api/v1/auth/oauth/providers");
        providers.EnsureSuccessStatusCode();
        var json = await providers.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        Assert.True(json.GetArrayLength() >= 3);

        var authorize = await client.GetAsync(
            "/api/v1/auth/oauth/google/authorize?redirectUri=accesscity%3A%2F%2Fauth%2Fcallback");
        Assert.Equal(HttpStatusCode.NotImplemented, authorize.StatusCode);
    }
}
