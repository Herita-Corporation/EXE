using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Task.Presentation;

public sealed class PremiumIamClient(IHttpClientFactory clients, IConfiguration config)
{
    private HttpRequestMessage Request(HttpContext context, HttpMethod method, string path)
    {
        var baseUrl = config["Premium:IamBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl)) throw new PremiumApiException(503, "Premium IAM service is not configured.");
        var request = new HttpRequestMessage(method, baseUrl.TrimEnd('/') + path);
        var raw = context.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(raw)) request.Headers.Authorization = AuthenticationHeaderValue.Parse(raw);
        return request;
    }

    public async global::System.Threading.Tasks.Task RequireActive(HttpContext context)
    {
        using var request = Request(context, HttpMethod.Get, "/api/premium/me");
        using var response = await clients.CreateClient("PremiumIam").SendAsync(request, context.RequestAborted);
        if (response.StatusCode == HttpStatusCode.Unauthorized) throw new PremiumApiException(401, "Bạn cần đăng nhập.");
        if (!response.IsSuccessStatusCode) throw new PremiumApiException(503, "Không thể kiểm tra quyền Premium lúc này.");
        var entitlement = await response.Content.ReadFromJsonAsync<Entitlement>(cancellationToken: context.RequestAborted);
        if (entitlement?.IsPremium != true) throw new PremiumApiException(403, "Cần gói DISA Premium còn hiệu lực để dùng tính năng này.");
    }

    public async global::System.Threading.Tasks.Task<IReadOnlyList<PremiumMember>> ResolveMembers(HttpContext context, string[] accounts)
    {
        using var request = Request(context, HttpMethod.Post, "/api/premium/members/resolve");
        request.Content = JsonContent.Create(new { accounts });
        using var response = await clients.CreateClient("PremiumIam").SendAsync(request, context.RequestAborted);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadFromJsonAsync<ErrorBody>(cancellationToken: context.RequestAborted);
            throw new PremiumApiException((int)response.StatusCode, detail?.Error ?? "Không thể xác minh thành viên Premium.");
        }
        return await response.Content.ReadFromJsonAsync<List<PremiumMember>>(cancellationToken: context.RequestAborted) ?? [];
    }

    private sealed record Entitlement(bool IsPremium);
    private sealed record ErrorBody(string? Error);
}

public sealed record PremiumMember(Guid Id, string Username);
public sealed class PremiumApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
