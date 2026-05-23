# syntax=docker/dockerfile:1

# ── Stage 1: Build ──────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build
WORKDIR /src

# Copy csproj first for layer-cached restore
COPY AccessCity.API.csproj ./
RUN dotnet restore

# Copy everything else and publish
COPY . ./
RUN dotnet publish -c Release -o /app/publish --no-restore

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble-chiseled-extra AS runtime
WORKDIR /app

COPY --from=build /app/publish .

# Expose the HTTP port
EXPOSE 8080

# Run as non-root
USER $APP_UID

ENTRYPOINT ["dotnet", "AccessCity.API.dll"]
