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

    public System.Threading.Tasks.Task DeleteAsync(string mediaUrl)
    {
        var path = Uri.TryCreate(mediaUrl, UriKind.Absolute, out var uri)
            ? uri.AbsolutePath
            : mediaUrl;
        var normalized = path.Replace('\\', '/').ToLowerInvariant();
        var folder = normalized.StartsWith("/uploads/videos/") ? "Videos"
            : normalized.StartsWith("/uploads/images/") ? "Images"
            : null;
        if (folder == null) return System.Threading.Tasks.Task.CompletedTask;

        var fileName = Path.GetFileName(path);
        var root = Path.GetFullPath(Path.Combine("Uploads", folder));
        var target = Path.GetFullPath(Path.Combine(root, fileName));
        if (target.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && File.Exists(target))
            File.Delete(target);
        return System.Threading.Tasks.Task.CompletedTask;
    }

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
