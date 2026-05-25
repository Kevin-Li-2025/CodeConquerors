using System.Net;
using System.Net.Http.Json;
using AccessCity.API.Models;

namespace AccessCity.Tests;

public sealed class AiAssistEndpointTests : IClassFixture<AccessCityApiFactory>
{
    private readonly AccessCityApiFactory _factory;

    public AiAssistEndpointTests(AccessCityApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task RouteExplanation_AcceptsFrontendGeoJsonRoutePayload()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/api/v1/ai-assist/route-explanation",
            new
            {
                routeRequest = new
                {
                    profile = "manual-wheelchair",
                    safetyWeight = 0.8,
                    preferences = new[] { "avoid-stairs", "prefer-crossings" }
                },
                route = new
                {
                    path = new
                    {
                        type = "LineString",
                        coordinates = new[] { new[] { -1.89, 52.48 }, new[] { -1.88, 52.485 } }
                    },
                    distance = 840,
                    estimatedTime = 720,
                    safetyScore = 0.82,
                    warnings = new[] { "Raised kerb near final crossing" }
                }
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var parsed = await response.Content.ReadFromJsonAsync<RouteExplanationResponse>();
        Assert.NotNull(parsed);
        Assert.False(parsed!.ForRouteDecision);
        Assert.Contains("deterministic router", parsed.Explanation, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("manual-wheelchair", parsed.Explanation, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Raised kerb", parsed.Explanation, StringComparison.OrdinalIgnoreCase);
    }
}
