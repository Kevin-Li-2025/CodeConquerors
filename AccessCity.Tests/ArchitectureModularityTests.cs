using AccessCity.API.Controllers;
using AccessCity.API.Data;
using AccessCity.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace AccessCity.Tests;

public sealed class ArchitectureModularityTests
{
    [Fact]
    public void Controllers_do_not_inject_app_db_context_directly()
    {
        var controllerTypes = typeof(RoutingController).Assembly
            .GetTypes()
            .Where(type => type.Namespace == "AccessCity.API.Controllers"
                           && !type.IsAbstract
                           && typeof(ControllerBase).IsAssignableFrom(type))
            .ToList();

        var violations = controllerTypes
            .SelectMany(type => type.GetConstructors()
                .SelectMany(ctor => ctor.GetParameters()
                    .Where(parameter => parameter.ParameterType == typeof(AppDbContext))
                    .Select(parameter => $"{type.Name}.{ctor.Name}({parameter.Name}: AppDbContext)")))
            .ToList();

        Assert.Empty(violations);
    }

    [Fact]
    public void Controllers_do_not_reference_data_namespace_in_source()
    {
        var root = FindRepositoryRoot();
        var controllerDirectory = Path.Combine(root, "AccessCity.API", "Controllers");
        var violations = Directory.EnumerateFiles(controllerDirectory, "*.cs", SearchOption.TopDirectoryOnly)
            .SelectMany(file => File.ReadLines(file)
                .Select((line, index) => new { file, line, index })
                .Where(item => item.line.Contains("AccessCity.API.Data", StringComparison.Ordinal)
                               || item.line.Contains("AppDbContext", StringComparison.Ordinal))
                .Select(item => $"{Path.GetFileName(item.file)}:{item.index + 1}: {item.line.Trim()}"))
            .ToList();

        Assert.Empty(violations);
    }

    [Fact]
    public void Controllers_depend_on_application_service_interfaces()
    {
        var controllerTypes = typeof(RoutingController).Assembly
            .GetTypes()
            .Where(type => type.Namespace == "AccessCity.API.Controllers"
                           && !type.IsAbstract
                           && typeof(ControllerBase).IsAssignableFrom(type))
            .ToList();

        var violations = controllerTypes
            .SelectMany(type => type.GetConstructors()
                .SelectMany(ctor => ctor.GetParameters()
                    .Where(parameter => IsConcreteAccessCityService(parameter.ParameterType))
                    .Select(parameter => $"{type.Name}.{ctor.Name}({parameter.Name}: {parameter.ParameterType.Name})")))
            .ToList();

        Assert.Empty(violations);
    }

    [Fact]
    public void Services_and_modules_do_not_reference_controllers()
    {
        var root = FindRepositoryRoot();
        var sourceDirectories = new[]
        {
            Path.Combine(root, "AccessCity.API", "Services"),
            Path.Combine(root, "AccessCity.API", "Modules")
        };

        var violations = sourceDirectories
            .SelectMany(directory => Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories))
            .SelectMany(file => File.ReadLines(file)
                .Select((line, index) => new { file, line, index })
                .Where(item => item.line.Contains("AccessCity.API.Controllers", StringComparison.Ordinal))
                .Select(item => $"{Path.GetRelativePath(root, item.file)}:{item.index + 1}: {item.line.Trim()}"))
            .ToList();

        Assert.Empty(violations);
    }

    [Fact]
    public void Kubernetes_uses_one_api_autoscaler_with_latency_signal()
    {
        var root = FindRepositoryRoot();
        var kustomization = File.ReadAllText(Path.Combine(root, "deploy", "kubernetes", "kustomization.yaml"));
        var scaledObject = File.ReadAllText(Path.Combine(root, "deploy", "kubernetes", "keda-scaledobject.yaml"));

        Assert.DoesNotContain("hpa.yaml", kustomization, StringComparison.Ordinal);
        Assert.Contains("name: accesscity-api-scalability", scaledObject, StringComparison.Ordinal);
        Assert.Contains("accesscity_safe_path_p95_ms", scaledObject, StringComparison.Ordinal);
        Assert.Contains("accesscity_route_capacity_saturation_rate", scaledObject, StringComparison.Ordinal);
    }

    private static bool IsConcreteAccessCityService(Type type)
    {
        if (type == typeof(AccessCityMetrics))
        {
            return false;
        }

        return type.IsClass
               && type.Namespace?.StartsWith("AccessCity.API.Services", StringComparison.Ordinal) == true;
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (File.Exists(Path.Combine(current.FullName, "CodeConquerors.sln")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate repository root containing CodeConquerors.sln.");
    }
}
