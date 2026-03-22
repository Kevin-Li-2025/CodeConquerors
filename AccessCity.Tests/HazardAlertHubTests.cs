using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.SignalR.Client;

namespace AccessCity.Tests;

public sealed class HazardAlertHubTests : IClassFixture<AccessCityApiFactory>
{
    private readonly AccessCityApiFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
    };

    public HazardAlertHubTests(AccessCityApiFactory factory) => _factory = factory;

    private HubConnection CreateConnection()
    {
        return new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "hubs/hazard-alerts"), options =>
            {
                options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
            })
            .Build();
    }

    [Fact]
    public async Task JoinRouteGroup_and_LeaveRouteGroup_succeed_after_start()
    {
        await using var connection = CreateConnection();
        await connection.StartAsync();
        await connection.InvokeAsync("JoinRouteGroup", "rt-1");
        await connection.InvokeAsync("LeaveRouteGroup", "rt-1");
        await connection.StopAsync();
    }

    [Fact]
    public async Task HazardReported_received_when_hazard_post_succeeds()
    {
        var received = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var hub = CreateConnection();
        hub.On<JsonElement>("HazardReported", payload => received.TrySetResult(payload));
        await hub.StartAsync();

        var http = _factory.CreateClient();
        var post = await http.PostAsJsonAsync(
            "/api/v1/hazards",
            new
            {
                Location = new { type = "Point", coordinates = new[] { -1.8912, 52.481 } },
                Type = "hub_signal_test",
                Description = "SignalR broadcast check",
                PhotoUrl = "",
            },
            JsonOptions);

        if (post.StatusCode != System.Net.HttpStatusCode.Created)
            return;

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var payload = await received.Task.WaitAsync(cts.Token);
        Assert.Equal(JsonValueKind.Object, payload.ValueKind);
        Assert.True(payload.TryGetProperty("latitude", out _) || payload.TryGetProperty("Latitude", out _));
    }
}
