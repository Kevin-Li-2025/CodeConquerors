using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AccessCity.API.Models.Identity;

namespace AccessCity.API.Services.Security
{
    public interface ITokenService
    {
        string CreateToken(AccessCityUser user);
        GeneratedRefreshToken GenerateRefreshToken(string ipAddress);
        string HashRefreshToken(string token);
    }

    public sealed record GeneratedRefreshToken(RefreshToken Entity, string Token);

    public class TokenService : ITokenService
    {
        private readonly IConfiguration _config;
        private readonly SymmetricSecurityKey _key;

        public TokenService(IConfiguration config)
        {
            _config = config;
            var secret = _config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured.");
            _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        }

        public string CreateToken(AccessCityUser user)
        {
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.NameId, user.Id),
                new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
                new(JwtRegisteredClaimNames.UniqueName, user.UserName ?? ""),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var creds = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256Signature);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(int.Parse(_config["Jwt:AccessTokenExpirationMinutes"] ?? "15")),
                SigningCredentials = creds,
                Issuer = _config["Jwt:Issuer"],
                Audience = _config["Jwt:Audience"]
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);

            return tokenHandler.WriteToken(token);
        }

        public GeneratedRefreshToken GenerateRefreshToken(string ipAddress)
        {
            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            var entity = new RefreshToken
            {
                Token = HashRefreshToken(rawToken),
                Expires = DateTime.UtcNow.AddDays(int.Parse(_config["Jwt:RefreshTokenExpirationDays"] ?? "7")),
                CreatedByIp = ipAddress
            };

            return new GeneratedRefreshToken(entity, rawToken);
        }

        public string HashRefreshToken(string token)
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return $"sha256:{Convert.ToHexString(hash).ToLowerInvariant()}";
        }
    }
}
