namespace Task.Application.DTOs.Requests;

public class PruneMissionsRequest
{
    /// <summary>Trips (itineraries) that still exist — missions under any other trip are removed.</summary>
    public List<Guid> KeepTripIds { get; set; } = new();
}
