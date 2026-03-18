using Microsoft.AspNetCore.Mvc;
using AccessCity.API.Models;
using AccessCity.API.Services;

namespace AccessCity.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HazardsController : ControllerBase
    {
        private readonly IRealHazardDataService _realHazardData;

        public HazardsController(IRealHazardDataService realHazardData)
        {
            _realHazardData = realHazardData;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<HazardReport>>> GetHazards([FromQuery] double? minLat, [FromQuery] double? minLng, [FromQuery] double? maxLat, [FromQuery] double? maxLng)
        {
            var hazards = await _realHazardData.GetActiveHazardsAsync(minLat, minLng, maxLat, maxLng);
            return Ok(hazards);
        }

        [HttpPost]
        public ActionResult<HazardReport> ReportHazard([FromBody] HazardReport report)
        {
            report.Id = Guid.NewGuid();
            report.ReportedAt = DateTime.UtcNow;
            report.Status = HazardStatus.Reported;
            return CreatedAtAction(nameof(GetHazardById), new { id = report.Id }, report);
        }

        [HttpGet("{id}")]
        public ActionResult<HazardReport> GetHazardById(Guid id)
        {
            return NotFound();
        }

        [HttpPatch("{id}")]
        public IActionResult UpdateHazardStatus(Guid id, [FromBody] HazardStatus status)
        {
            return NoContent();
        }
    }
}
