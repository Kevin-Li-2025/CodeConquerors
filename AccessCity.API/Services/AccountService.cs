using AccessCity.API.Data;
using AccessCity.API.Models;
using AccessCity.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AccessCity.API.Services;

public interface IAccountService
{
    Task<AccountProfileStatsDto> GetProfileStatsAsync(string userId, CancellationToken cancellationToken);

    Task<SupportContactResponse> CreateSupportContactAsync(
        string userId,
        string email,
        string name,
        string category,
        string subject,
        string message,
        CancellationToken cancellationToken);
}

public sealed class AccountService : IAccountService
{
    private readonly AppDbContext _dbContext;

    public AccountService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<AccountProfileStatsDto> GetProfileStatsAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var reportsSubmitted = await _dbContext.Hazards
            .AsNoTracking()
            .CountAsync(hazard => hazard.ReporterUserId == userId, cancellationToken);
        var resolvedReports = await _dbContext.Hazards
            .AsNoTracking()
            .CountAsync(
                hazard => hazard.ReporterUserId == userId && hazard.Status == HazardStatus.Resolved,
                cancellationToken);

        return new AccountProfileStatsDto(
            reportsSubmitted,
            resolvedReports,
            reportsSubmitted + resolvedReports);
    }

    public async Task<SupportContactResponse> CreateSupportContactAsync(
        string userId,
        string email,
        string name,
        string category,
        string subject,
        string message,
        CancellationToken cancellationToken)
    {
        var submission = new SupportContactSubmission
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Email = email,
            Name = name,
            Category = category,
            Subject = subject,
            Message = message,
            Status = "open",
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.SupportContactSubmissions.Add(submission);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SupportContactResponse(submission.Id, submission.Status, submission.CreatedAtUtc);
    }
}
