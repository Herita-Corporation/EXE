using Task.Application.DTOs.Requests;
using Task.Application.Interfaces.Services;
using Task.Application.Interfaces.Repositories;
using Task.Domain.Entities;
using Task.Domain.Enums;
using Task.Application.Interfaces;

namespace Task.Application.Services;

public class MissionSubmissionService : IMissionSubmissionService
{
    private readonly IUserMissionRepository _userMissionRepository;

    private readonly IMissionSubmissionRepository _submissionRepository;

    private readonly IMissionEvidenceRepository _evidenceRepository;

    private readonly IFileStorageService _fileStorageService;
    public MissionSubmissionService(
    IUserMissionRepository userMissionRepository,
    IMissionSubmissionRepository submissionRepository,
    IMissionEvidenceRepository evidenceRepository,
    IFileStorageService fileStorageService)
    {
        _userMissionRepository = userMissionRepository;
        _submissionRepository = submissionRepository;
        _evidenceRepository = evidenceRepository;
        _fileStorageService = fileStorageService;
    }
    public MissionSubmissionService(
        IUserMissionRepository userMissionRepository,
        IMissionSubmissionRepository submissionRepository,
        IMissionEvidenceRepository evidenceRepository)
    {
        _userMissionRepository = userMissionRepository;
        _submissionRepository = submissionRepository;
        _evidenceRepository = evidenceRepository;
    }
    public async System.Threading.Tasks.Task<Guid> SubmitMissionAsync(
     Guid userMissionId,
     SubmitMissionRequest request)
    {
        var mission = await _userMissionRepository.GetByIdAsync(userMissionId);

        if (mission == null)
            throw new Exception("Mission not found.");

        if (mission.Status != MissionStatus.Assigned)
            throw new Exception("Mission cannot be submitted.");

        // Vị trí phải khớp địa điểm nhiệm vụ — kiểm tra TRƯỚC khi lưu gì,
        // để nộp sai chỗ không tạo submission và nhiệm vụ vẫn ở Assigned
        // (người dùng có thể đến đúng chỗ rồi nộp lại).
        if (mission.TargetLatitude.HasValue && mission.TargetLongitude.HasValue)
        {
            if (!request.Latitude.HasValue || !request.Longitude.HasValue)
                throw new InvalidOperationException("Cần vị trí hiện tại để xác minh nhiệm vụ.");

            var distance = DistanceMeters(
                request.Latitude.Value, request.Longitude.Value,
                mission.TargetLatitude.Value, mission.TargetLongitude.Value);

            if (distance > MaxDistanceMeters)
                throw new InvalidOperationException(
                    $"Vị trí không hợp lệ — bạn đang cách địa điểm nhiệm vụ khoảng {FormatDistance(distance)}.");
        }

        // Tạo Submission — tự động duyệt ngay khi nộp (chưa có màn hình
        // admin duyệt thủ công nào tồn tại).
        var submission = new MissionSubmission
        {
            UserMissionId = mission.Id,
            SubmittedAt = DateTime.UtcNow,
            VerificationStatus = VerificationStatus.Approved
        };

        await _submissionRepository.AddAsync(submission);

        // ===========================
        // Upload ảnh
        // ===========================
        if (request.Photo != null)
        {
            var imageUrl = await _fileStorageService.UploadImageAsync(request.Photo);

            var evidence = new MissionEvidence
            {
                SubmissionId = submission.Id,
                Type = EvidenceType.Photo,
                MediaUrl = imageUrl,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                TakenAt = request.TakenAt
            };

            await _evidenceRepository.AddAsync(evidence);
        }

        // ===========================
        // Upload video
        // ===========================
        if (request.Video != null)
        {
            var videoUrl = await _fileStorageService.UploadVideoAsync(request.Video);

            var evidence = new MissionEvidence
            {
                SubmissionId = submission.Id,
                Type = EvidenceType.Video,
                MediaUrl = videoUrl,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                TakenAt = request.TakenAt
            };

            await _evidenceRepository.AddAsync(evidence);
        }

        // Cập nhật trạng thái nhiệm vụ — tự động hoàn thành ngay khi nộp
        mission.Status = MissionStatus.Completed;
        mission.CompletedAt = DateTime.UtcNow;
        await _userMissionRepository.UpdateAsync(mission);

        return submission.Id;
    }

    // Place GPS comes from free-text geocoding of the place name, so it can
    // be off by a block or two — keep the radius forgiving.
    private const double MaxDistanceMeters = 1000;

    private static double DistanceMeters(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371000;
        static double ToRad(double d) => d * Math.PI / 180;
        var dLat = ToRad(lat2 - lat1);
        var dLng = ToRad(lng2 - lng1);
        var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * R * Math.Asin(Math.Sqrt(h));
    }

    private static string FormatDistance(double meters) =>
        meters >= 1000 ? $"{meters / 1000:0.#} km" : $"{Math.Round(meters)} m";
}
