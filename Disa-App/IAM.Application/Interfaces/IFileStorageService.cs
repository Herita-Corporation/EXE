using Microsoft.AspNetCore.Http;

namespace IAM.Application.Interfaces;

public interface IFileStorageService
{
    Task<string> UploadImageAsync(IFormFile file);
}
