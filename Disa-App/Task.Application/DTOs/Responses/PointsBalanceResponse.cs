namespace Task.Application.DTOs.Responses;

public class PointsBalanceResponse
{
    public int EarnedPoints { get; set; }

    public int SpentPoints { get; set; }

    public int AvailablePoints { get; set; }
}
