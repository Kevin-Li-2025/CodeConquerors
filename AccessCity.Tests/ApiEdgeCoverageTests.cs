using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AccessCity.Tests;

public sealed class ApiEdgeCoverageTests : IClassFixture<AccessCityApiFactory>
{
    private readonly AccessCityApiFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
    };

    public ApiEdgeCoverageTests(AccessCityApiFactory factory) => _factory = factory;

    [Theory]
    [InlineData(91, 0)]
    [InlineData(-91, 0)]
    [InlineData(0, 181)]
    [InlineData(0, -181)]
    public async Task SafeHaven_nearby_invalid_coordinates_returns_400(double lat, double lng)
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/v1/safe-haven/nearby?lat={lat}&lng={lng}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Admin_osm_import_without_token_returns_401()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsync("/api/v1/admin/osm/import", null);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Hazards_get_with_status_query_returns_200_or_503()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/hazards?status=Reported");
        if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
            return;
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Hazards_getById_non_guid_segment_returns_404()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/hazards/not-a-guid");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Routing_safe_path_options_empty_body_returns_400()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/routing/safe-path/options", new { }, JsonOptions);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Integrations_status_returns_config_flags()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/integrations/status");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        Assert.True(json.TryGetProperty("overpassEndpoint", out _) || json.TryGetProperty("OverpassEndpoint", out _));
        Assert.True(json.TryGetProperty("notes", out _) || json.TryGetProperty("Notes", out _));
    }
}
