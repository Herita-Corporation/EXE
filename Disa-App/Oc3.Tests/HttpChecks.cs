using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

static class HttpChecks
{
    public static async System.Threading.Tasks.Task Run(string server, string taskConnection)
    {
        var sql = new SqlConnectionStringBuilder { DataSource = server, InitialCatalog = "master", IntegratedSecurity = true, TrustServerCertificate = true };
        var database = "DISA_OC3_TEST_IAM_" + Guid.NewGuid().ToString("N");
        await using (var master = new SqlConnection(sql.ConnectionString)) { await master.OpenAsync(); await using var cmd = master.CreateCommand(); cmd.CommandText = $"CREATE DATABASE [{database}]"; await cmd.ExecuteNonQueryAsync(); }
        sql.InitialCatalog = database;
        Console.WriteLine("Isolated IAM test database: " + database);
        var password = Guid.NewGuid().ToString("N");
        var hasher = new BCryptPassworkHasher(); var users = new Dictionary<string, Guid>();
        await using (var db = new IAMDbContext(new DbContextOptionsBuilder<IAMDbContext>().UseSqlServer(sql.ConnectionString).Options))
        {
            await db.Database.EnsureCreatedAsync();
            var roles = new[] { "Admin", "Customer", "Partner", "Manager" }.Select(n => new Role { Id = Guid.NewGuid(), Name = n }).ToArray(); db.AddRange(roles);
            foreach (var name in new[] { "admin", "owner", "traveler", "staff", "outsider" })
            { var u = new User { Id = Guid.NewGuid(), Username = "oc3-" + name, Email = name == "admin" ? "admin@system.com" : name + "@oc3.invalid", PasswordHash = hasher.Hash(password), IsActive = true, CreatedAt = DateTime.UtcNow }; u.Roles.Add(roles.Single(r => r.Name == (name == "admin" ? "Admin" : "Customer"))); db.Add(u); users[name] = u.Id; }
            await db.SaveChangesAsync();
        }
        const string jwtKey = "OC3-TEST-ONLY-KEY-NOT-FOR-DEPLOYMENT-0123456789";
        var common = new Dictionary<string, string> { ["Jwt__Key"] = jwtKey, ["Jwt__Issuer"] = "oc3-test", ["Jwt__Audience"] = "oc3-test", ["ASPNETCORE_ENVIRONMENT"] = "Development", ["PartnerVouchers__Enabled"] = "true", ["PartnerVouchers__SyncKey"] = "OC3-TEST-ONLY-SYNC-NOT-FOR-DEPLOYMENT", ["PartnerVouchers__TokenKey"] = "OC3-TEST-ONLY-TOKEN-NOT-FOR-DEPLOYMENT", ["PartnerVouchers__AllowTestCampaigns"] = "true", ["PartnerVouchers__IamBaseUrl"] = "http://127.0.0.1:55195", ["PartnerVouchers__TaskBaseUrl"] = "http://127.0.0.1:55020" };
        var root = Path.GetFullPath("Disa-App");
        if (!Directory.Exists(root)) throw new Exception("Run from repository root, containing Disa-App.");
        Process Start(string project, string dll, int port, string connectionKey, string conn)
        {
            var binary = Path.Combine(root, project, "bin", "Debug", "net8.0", dll);
            var start = new ProcessStartInfo(Environment.ProcessPath ?? "dotnet") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true, WorkingDirectory = Path.Combine(root, project) };
            // When this harness is an apphost, locate dotnet via DOTNET_ROOT.
            var runtimeRoot = Environment.GetEnvironmentVariable("DOTNET_ROOT");
            start.FileName = string.IsNullOrWhiteSpace(runtimeRoot) ? "dotnet" : Path.Combine(runtimeRoot, OperatingSystem.IsWindows() ? "dotnet.exe" : "dotnet");
            start.ArgumentList.Add(binary); start.ArgumentList.Add("--urls"); start.ArgumentList.Add($"http://127.0.0.1:{port}");
            foreach (var pair in common) start.Environment[pair.Key] = pair.Value;
            start.Environment[connectionKey] = conn;
            var process = Process.Start(start) ?? throw new Exception("Unable to launch test host");
            process.OutputDataReceived += (_, _) => { }; process.ErrorDataReceived += (_, _) => { }; process.BeginOutputReadLine(); process.BeginErrorReadLine(); return process;
        }
        using var iam = Start("IAMService", "IAM.Presentation.dll", 55195, "ConnectionStrings__IAMDb", sql.ConnectionString);
        using var task = Start("Task.Presentation", "Task.Presentation.dll", 55020, "ConnectionStrings__TaskDb", taskConnection);
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        try
        {
            foreach (var url in new[] { "http://127.0.0.1:55195/api/oc3/session", "http://127.0.0.1:55020/health/live" })
            {
                bool ready = false; for (int i = 0; i < 50; i++) { try { using var r = await client.GetAsync(url); ready = true; break; } catch (HttpRequestException) { await System.Threading.Tasks.Task.Delay(200); } }
                if (!ready) throw new Exception("Test host did not start: " + url);
            }
            async System.Threading.Tasks.Task<JsonElement> Send(string host, string path, string? token = null, object? body = null, string method = "POST", string? key = null, HttpStatusCode expected = HttpStatusCode.OK)
            {
                using var request = new HttpRequestMessage(new HttpMethod(method), (host == "iam" ? "http://127.0.0.1:55195" : "http://127.0.0.1:55020") + path);
                if (token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                if (body != null) request.Content = JsonContent.Create(body);
                if (key != null) request.Headers.Add("Idempotency-Key", key);
                using var response = await client.SendAsync(request); var content = await response.Content.ReadAsStringAsync();
                if (response.StatusCode != expected) throw new Exception($"HTTP FAIL {method} {path}: {(int)response.StatusCode} (expected {(int)expected}); body omitted to avoid token leakage.");
                return string.IsNullOrWhiteSpace(content) ? default : JsonDocument.Parse(content).RootElement.Clone();
            }
            var tokens = new Dictionary<string, string>();
            foreach (var name in users.Keys) { var response = await Send("iam", "/api/auth/login", body: new { username = "oc3-" + name, password }); tokens[name] = response.GetProperty("accessToken").GetString()!; }
            Console.WriteLine("PASS: HTTP password login resolves dependency injection and returns JWT");
            var admin = tokens["admin"]; var traveler = tokens["traveler"]; var staff = tokens["staff"];
            var p = await Send("iam", "/api/oc3/partners", admin, new { ownerUserId = users["owner"], businessName = "TEST ONLY", businessType = "Cafe", ownerName = "Test Owner", phoneNumber = "0000000000", address = "Test address" });
            var partnerId = p.GetProperty("id").GetGuid();
            await Send("iam", $"/api/admin/partner-portal/partners/{partnerId}/status", admin, new { status = "Active" }, "PATCH", expected: HttpStatusCode.NoContent);
            var request = await Send("iam", $"/api/oc3/partners/{partnerId}/requests", admin, new { title = "TEST ONLY venue", content = "Internal test", price = 10000, openingTime = "08:00:00", closingTime = "22:00:00", location = "Test address", latitude = 10.75, longitude = 106.66 });
            var requestId = request.GetProperty("id").GetGuid();
            await Send("iam", $"/api/oc3/requests/{requestId}/submit", admin, new { });
            await Send("iam", $"/api/admin/partner-portal/requests/{requestId}/review", admin, new { isApproved = true, reason = (string?)null });
            var loc = await Send("iam", "/api/oc3/locations", admin, new { partnerId, sourceRequestId = requestId, consentReference = "TEST FIXTURE - not a real consent" });
            var locationId = loc.GetProperty("id").GetGuid();
            await Send("iam", $"/api/oc3/locations/{locationId}/publish", admin, new { });
            var invite = await Send("iam", $"/api/oc3/locations/{locationId}/staff-invitations", admin, new { userId = users["staff"] });
            await Send("iam", $"/api/oc3/memberships/{invite.GetProperty("id").GetGuid()}/accept", staff, new { }, expected: HttpStatusCode.NoContent);
            await System.Threading.Tasks.Task.Delay(12000);
            var c = await Send("task", "/api/v2/admin/campaigns", admin, new { locationId, title = "HTTP TEST", terms = "Test only", discountType = "PERCENT", percentageBps = 1000, fixedAmount = 0, maxDiscountAmount = 30000, minSpend = 10000, usageMode = "IMMEDIATE_OR_LATER", validDays = 30, totalQuota = 10, claimStartsAt = DateTime.UtcNow.AddDays(-1), claimEndsAt = DateTime.UtcNow.AddDays(1), redeemEndsAt = DateTime.UtcNow.AddDays(31), dataMode = "INTERNAL_TEST" });
            var campaignId = c.GetProperty("id").GetGuid(); await Send("task", $"/api/v2/admin/campaigns/{campaignId}/publish", admin, new { });
            var offers = await Send("task", "/api/v2/me/offers?surface=home", traveler, method: "GET");
            if (!offers.EnumerateArray().Any(o => o.GetProperty("campaignId").GetGuid() == campaignId && o.GetProperty("canClaim").GetBoolean())) throw new Exception("Published campaign missing from home offers");
            Console.WriteLine("PASS: HTTP manual partner -> review -> publication outbox -> Task campaign");
            await Send("task", "/api/v2/me/vouchers", method: "GET", expected: HttpStatusCode.Unauthorized);
            var v = await Send("task", $"/api/v2/me/campaigns/{campaignId}/claim", traveler, new { acquisitionContextToken = (string?)null }, key: Guid.NewGuid().ToString());
            var voucherId = v.GetProperty("voucherId").GetGuid();
            var savedOffers = await Send("task", "/api/v2/me/offers?surface=home", traveler, method: "GET");
            if (!savedOffers.EnumerateArray().Any(o => o.GetProperty("campaignId").GetGuid() == campaignId && o.GetProperty("ownedVoucherId").GetGuid() == voucherId && !o.GetProperty("canClaim").GetBoolean())) throw new Exception("Home card did not reflect saved voucher");
            if (!v.GetProperty("expiresAt").GetString()!.EndsWith("Z")) throw new Exception("Missing UTC suffix");
            await Send("task", $"/api/v2/me/vouchers/{voucherId}", tokens["outsider"], method: "GET", expected: HttpStatusCode.NotFound);
            var presentation = await Send("task", $"/api/v2/me/vouchers/{voucherId}/presentations", traveler, new { });
            var verificationBody = new { locationId, shortCode = presentation.GetProperty("shortCode").GetString(), presentationToken = (string?)null, eligibleSubtotal = 100000, orderRef = "HTTP-TEST" };
            await Send("task", "/api/v2/partner/voucher-verifications", tokens["outsider"], verificationBody, expected: HttpStatusCode.Forbidden);
            var verify = await Send("task", "/api/v2/partner/voucher-verifications", staff, verificationBody);
            var confirmation = new { verificationTicket = verify.GetProperty("verificationTicket").GetString() }; var confirmKey = Guid.NewGuid().ToString();
            var receipt = await Send("task", "/api/v2/partner/redemptions", staff, confirmation, key: confirmKey);
            var retry = await Send("task", "/api/v2/partner/redemptions", staff, confirmation, key: confirmKey);
            if (receipt.GetProperty("redemptionId").GetGuid() != retry.GetProperty("redemptionId").GetGuid()) throw new Exception("Idempotent HTTP receipt mismatch");
            await Send("task", "/api/v2/partner/redemptions", staff, confirmation, key: Guid.NewGuid().ToString(), expected: HttpStatusCode.Conflict);
            var history = await Send("task", "/api/v2/me/vouchers?bucket=history", traveler, method: "GET");
            if (!history.EnumerateArray().Any(x => x.GetProperty("voucherId").GetGuid() == voucherId && x.GetProperty("status").GetString() == "REDEEMED")) throw new Exception("History status missing");
            Console.WriteLine("PASS: HTTP auth/ownership/staff scope/claim/short-code/confirm/retry/history/UTC");
            var qrKey = c.GetProperty("qrKey").GetString()!;
            await Send("task", "/api/v2/public/qr/" + qrKey, method: "GET");
            var acquisition = await Send("task", "/api/v2/public/acquisition-contexts", body: qrKey);
            var context = acquisition.GetProperty("acquisitionContextToken").GetString();
            var fromQr = await Send("task", $"/api/v2/me/campaigns/{campaignId}/claim", traveler, new { acquisitionContextToken = context }, key: Guid.NewGuid().ToString());
            if (fromQr.GetProperty("voucherId").GetGuid() != voucherId) throw new Exception("Home and QR created two vouchers");
            var secondContext = await Send("task", "/api/v2/public/acquisition-contexts", body: qrKey);
            var secondVoucher = await Send("task", $"/api/v2/me/campaigns/{campaignId}/claim", tokens["outsider"], new { acquisitionContextToken = secondContext.GetProperty("acquisitionContextToken").GetString() }, key: Guid.NewGuid().ToString());
            var secondId = secondVoucher.GetProperty("voucherId").GetGuid();
            var secondPresentation = await Send("task", $"/api/v2/me/vouchers/{secondId}/presentations", tokens["outsider"], new { });
            var secondBody = new { locationId, shortCode = secondPresentation.GetProperty("shortCode").GetString(), presentationToken = (string?)null, eligibleSubtotal = 100000, orderRef = "SECOND-TEST" };
            var secondVerification = await Send("task", "/api/v2/partner/voucher-verifications", staff, secondBody);
            await Send("iam", $"/api/oc3/memberships/{invite.GetProperty("id").GetGuid()}", admin, method: "DELETE", expected: HttpStatusCode.NoContent);
            await Send("task", "/api/v2/partner/redemptions", staff, new { verificationTicket = secondVerification.GetProperty("verificationTicket").GetString() }, key: Guid.NewGuid().ToString(), expected: HttpStatusCode.Forbidden);
            Console.WriteLine("PASS: acquisition QR uses same wallet; staff revocation takes effect before confirm");
            var reinvite = await Send("iam", $"/api/oc3/locations/{locationId}/staff-invitations", admin, new { userId = users["staff"] });
            await Send("iam", $"/api/oc3/memberships/{reinvite.GetProperty("id").GetGuid()}/accept", staff, new { }, expected: HttpStatusCode.NoContent);
            await Send("iam", "/api/auth/delete-account", tokens["outsider"], new { password }, "DELETE");
            await Send("task", "/api/v2/me/vouchers", tokens["outsider"], method: "GET", expected: HttpStatusCode.Unauthorized);
            await Send("task", "/api/v2/partner/voucher-verifications", staff, secondBody, expected: HttpStatusCode.Forbidden);
            Console.WriteLine("PASS: deleted account JWT and previously issued presentation cannot redeem");
            await Send("iam", "/api/auth/delete-account", tokens["owner"], new { password }, "DELETE", expected: HttpStatusCode.Conflict);
            await Send("iam", $"/api/oc3/partners/{partnerId}/owner", admin, new { ownerUserId = users["admin"], reason = "Test account ownership handoff" });
            await Send("iam", "/api/auth/delete-account", tokens["owner"], new { password }, "DELETE");
            Console.WriteLine("PASS: partner records block unsafe deletion; audited owner handoff permits account deletion");
        }
        finally { if (!iam.HasExited) iam.Kill(true); if (!task.HasExited) task.Kill(true); }
    }
}
