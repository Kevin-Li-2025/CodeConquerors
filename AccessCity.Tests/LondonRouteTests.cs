using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using AccessCity.API.Models;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Xunit.Abstractions;

namespace AccessCity.Tests;

public class SpecificRouteTests : IClassFixture<AccessCityApiFactory>
{
    private readonly AccessCityApiFactory _factory;
    private readonly ITestOutputHelper _output;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new NetTopologySuite.IO.Converters.GeoJsonConverterFactory() }
    };

    public SpecificRouteTests(AccessCityApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    [Fact]
    public async Task GetLondonRoute_Deacon_To_Elephant()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        
        // Deacon St, Hurlock Heights: 51.4925, -0.0979
        // Elephant & Castle Underground: 51.4958, -0.1007
        var request = new { 
            Start = new { X = -0.0979, Y = 51.4925 }, 
            End = new { X = -0.1007, Y = 51.4958 }, 
            SafetyWeight = 0.5,
            Profile = "standard"
        };

        var response = await client.PostAsJsonAsync("/api/v1/routing/safe-path", request, JsonOptions);
        var result = await response.Content.ReadFromJsonAsync<RouteResponse>(JsonOptions);
        
        _output.WriteLine($"### Route Test: Deacon St -> Elephant & Castle");
        _output.WriteLine($"- **Distance**: {result!.Distance:F1}m");
        _output.WriteLine($"- **Estimated Time**: {result.EstimatedTime:F1} mins");
        _output.WriteLine($"- **Safety Score**: {result.SafetyScore:P1}");
    }

    [Fact]
    public async Task GetBirminghamRoute_MoorSt_To_NewSt()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        
        // Moor St: 52.4789, -1.8926
        // New St: 52.4777, -1.8989
        var request = new { 
            Start = new { X = -1.8926, Y = 52.4789 }, 
            End = new { X = -1.8989, Y = 52.4777 }, 
            SafetyWeight = 0.0,
            Profile = "standard"
        };

        var response = await client.PostAsJsonAsync("/api/v1/routing/safe-path", request, JsonOptions);
        var result = await response.Content.ReadFromJsonAsync<RouteResponse>(JsonOptions);
        
        _output.WriteLine($"### Route Test: Birmingham Moor St -> Birmingham New St");
        _output.WriteLine($"- **Distance**: {result!.Distance:F1}m");
        _output.WriteLine($"- **Estimated Time**: {result.EstimatedTime:F1} mins");
        _output.WriteLine($"- **Safety Score**: {result.SafetyScore:P1}");
    }

    [Fact]
    public async Task GetLondonRoute_Hurlock_To_Lcc()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        
        // Hurlock Heights: 51.4925, -0.0979
        // LCC UAL: 51.4947, -0.1019
        var request = new { 
            Start = new { X = -0.0979, Y = 51.4925 }, 
            End = new { X = -0.1019, Y = 51.4947 }, 
            SafetyWeight = 0.5,
            Profile = "standard"
        };

        var response = await client.PostAsJsonAsync("/api/v1/routing/safe-path", request, JsonOptions);
        var result = await response.Content.ReadFromJsonAsync<RouteResponse>(JsonOptions);
        
        _output.WriteLine($"### Route Test: Hurlock Heights -> LCC UAL");
        _output.WriteLine($"- **Distance**: {result!.Distance:F1}m");
        _output.WriteLine($"- **Estimated Time**: {result.EstimatedTime:F1} mins");
        _output.WriteLine($"- **Safety Score**: {result.SafetyScore:P1}");
    }

    [Fact]
    public async Task GetLondonRoute_Hurlock_To_Waterloo()
    {
        var client = await _factory.CreateAuthenticatedClientAsync();
        
        // Waterloo Station: 51.5035, -0.1142
        var request = new { 
            Start = new { X = -0.0979, Y = 51.4925 }, 
            End = new { X = -0.1142, Y = 51.5035 }, 
            SafetyWeight = 0.5,
            Profile = "standard"
        };

        var response = await client.PostAsJsonAsync("/api/v1/routing/safe-path", request, JsonOptions);
        var result = await response.Content.ReadFromJsonAsync<RouteResponse>(JsonOptions);
        
        _output.WriteLine($"### Route Test: Hurlock Heights -> Waterloo Station");
        _output.WriteLine($"- **Distance**: {result!.Distance:F1}m");
        _output.WriteLine($"- **Estimated Time**: {result.EstimatedTime:F1} mins");
        _output.WriteLine($"- **Safety Score**: {result.SafetyScore:P1}");
    }
}
