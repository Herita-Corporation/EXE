using Microsoft.AspNetCore.Http;
using Task.Application.Interfaces.Services;

namespace Task.Infrastructure.Services;

public class FileStorageService : IFileStorageService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public FileStorageService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public System.Threading.Tasks.Task<string> UploadImageAsync(IFormFile file) =>
        SaveAsync(file, "Images", "images");

    public System.Threading.Tasks.Task<string> UploadVideoAsync(IFormFile file) =>
        SaveAsync(file, "Videos", "videos");

    // Saves under Uploads/{folderName} (served by app.UseStaticFiles() in
    // Program.cs, mounted at "/uploads" and backed by a docker volume so
    // files survive a container restart) and returns an absolute URL the
    // frontend can load directly, instead of the raw on-disk path.
    private async System.Threading.Tasks.Task<string> SaveAsync(IFormFile file, string folderName, string urlSegment)
    {
        var folder = Path.Combine("Uploads", folderName);

        if (!Directory.Exists(folder))
            Directory.CreateDirectory(folder);

        var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);

        var path = Path.Combine(folder, fileName);

        using (var stream = new FileStream(path, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var request = _httpContextAccessor.HttpContext?.Request;
        if (request == null)
            return $"/uploads/{urlSegment}/{fileName}";

        return $"{request.Scheme}://{request.Host}/uploads/{urlSegment}/{fileName}";
    }
}