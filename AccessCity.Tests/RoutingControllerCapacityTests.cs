using AccessCity.API.Configuration;
using AccessCity.API.Controllers;
using AccessCity.API.Models;
using AccessCity.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Moq;
using NetTopologySuite.Geometries;
using Xunit;

namespace AccessCity.Tests;

public sealed class RoutingControllerCapacityTests
{
    [Fact]
    public async Task SafePathOptions_ShedsStandardVariantWorkBeforeHazardLookup_WhenRouteCapacityIsSaturated()
    {
        var request = new RouteRequest
        {
            Start = new Coordinate(-1.8904, 52.4862),
            End = new Coordinate(-1.8804, 52.4862),
            Profile = "standard",
            SafetyWeight = 0.5,
            Preferences = new List<string>()
        };

        var hazardQueries = new Mock<IHazardQueryService>(MockBehavior.Strict);
        var routeLimiter = new Mock<IRouteComputationLimiter>(MockBehavior.Strict);
        var coalescing = new Mock<IRouteCoalescingService>(MockBehavior.Strict);

        routeLimiter
            .Setup(limiter => limiter.TryAcquireAsync(It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns(new ValueTask<RouteComputationLease?>((RouteComputationLease?)null));

        coalescing
            .Setup(service => service.GetOrComputeOptionsAsync(
                It.IsAny<RouteRequest>(),
                It.IsAny<Func<Task<SafePathOptionsResponse?>>>()))
            .Returns((RouteRequest _, Func<Task<SafePathOptionsResponse?>> factory) => factory());

        var controller = CreateController(
            hazardQueries.Object,
            routeLimiter.Object,
            coalescing.Object);

        var response = await controller.GetSafePathOptions(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(response.Result);
        Assert.Equal(503, objectResult.StatusCode);
        hazardQueries.Verify(
            queries => queries.LoadHazardsForRouteAsync(It.IsAny<RouteRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
        routeLimiter.Verify(
            limiter => limiter.TryAcquireAsync(It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static RoutingController CreateController(
        IHazardQueryService hazardQueries,
        IRouteComputationLimiter routeLimiter,
        IRouteCoalescingService coalescing)
    {
        return new RoutingController(
            Mock.Of<IRoutingService>(),
            Mock.Of<IRiskScoringService>(),
            Mock.Of<IPredictiveRiskModel>(),
            hazardQueries,
            Mock.Of<IRouteJobService>(),
            coalescing,
            routeLimiter,
            Mock.Of<IRouteCacheService>(),
            Mock.Of<IRouteOptionsCacheService>(),
            Mock.Of<IRiskScoreCacheService>(),
            Mock.Of<IRouteGraphStatusService>(),
            new AccessCityMetrics(),
            Options.Create(new RoutingOptions
            {
                AsyncFirstForCacheMiss = false,
                ComputationQueueTimeoutSeconds = 1,
                SyncSafePathTimeoutSeconds = 2
            }));
    }
}
