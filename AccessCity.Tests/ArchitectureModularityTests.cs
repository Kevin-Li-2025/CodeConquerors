using AccessCity.API.Controllers;
using AccessCity.API.Data;
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
