using Microsoft.AspNetCore.Http;

namespace Task.Application.Interfaces.Services;

public interface IFileStorageService
{
    System.Threading.Tasks.Task<string> UploadImageAsync(IFormFile file);

    System.Threading.Tasks.Task<string> UploadVideoAsync(IFormFile file);
}