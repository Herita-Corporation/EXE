using IAM.Application.Interfaces;
using Microsoft.AspNetCore.Http;

namespace IAM.Application.Services;

// Colocated with AuthService here (not IAM.Infrastructure) because IAM's
// layering runs Application -> Infrastructure (see IAM.Application.csproj),
// the reverse of Task.*'s normal Domain<-Application<-Infrastructure chain —
// an implementation in Infrastructure couldn't reference this interface.
public class FileStorageService : IFileStorageService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public FileStorageService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<string> UploadImageAsync(IFormFile file)
    {
        var folder = Path.Combine("Uploads", "Images");

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
            return $"/uploads/images/{fileName}";

        return $"{request.Scheme}://{request.Host}/uploads/images/{fileName}";
    }
}
