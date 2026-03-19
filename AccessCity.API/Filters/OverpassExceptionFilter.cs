using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Net;

namespace AccessCity.API.Filters
{
    public class OverpassExceptionFilter : IExceptionFilter
    {
        private readonly ILogger<OverpassExceptionFilter> _logger;

        public OverpassExceptionFilter(ILogger<OverpassExceptionFilter> logger)
        {
            _logger = logger;
        }

        public void OnException(ExceptionContext context)
        {
            _logger.LogError(context.Exception, "An error occurred while calling the Overpass API.");

            var response = new
            {
                error = "External API Error",
                message = "The service is temporarily unable to fetch data from OpenStreetMap. Please try again later.",
                details = context.Exception.InnerException?.Message ?? context.Exception.Message
            };

            context.Result = new ObjectResult(response)
            {
                StatusCode = (int)HttpStatusCode.ServiceUnavailable
            };

            context.ExceptionHandled = true;
        }
    }
}
