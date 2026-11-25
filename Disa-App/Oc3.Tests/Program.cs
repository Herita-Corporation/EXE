using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Task.Infrastructure.Persistence;
using Task.Infrastructure.PartnerVouchers;

static void Check(bool condition, string name)
{ if (!condition) throw new Exception("FAIL: " + name); Console.WriteLine("PASS: " + name); }
var now = DateTime.UtcNow;
var rulesCampaign = new Campaign { MinSpend = 100000, DiscountType = "PERCENT", PercentageBps = 1000, MaxDiscountAmount = 30000, Location = new LocationSnapshot() };
Check(VoucherRules.Discount(rulesCampaign, 200000) == 20000, "percent discount");
Check(VoucherRules.Discount(rulesCampaign, 500000) == 30000, "discount cap");
Check(VoucherRules.EffectiveStatus(new VoucherInstance { Status = "REDEEMED", ExpiresAt = now.AddDays(-1) }, now) == "REDEEMED", "used stays used after expiry");
Check(VoucherRules.EffectiveStatus(new VoucherInstance { ExpiresAt = now.AddSeconds(-1) }, now) == "EXPIRED", "expiry without scheduler");
rulesCampaign.UsageMode = "RETURN_VISIT";
var fixedNow = new DateTime(2026, 11, 8, 8, 0, 0, DateTimeKind.Utc);
Check(VoucherRules.RedeemableFrom(rulesCampaign, fixedNow) == new DateTime(2026, 11, 8, 17, 0, 0, DateTimeKind.Utc), "next Vietnam midnight");
if (args.Contains("--media"))
{
    var pos = Array.IndexOf(args, "--media");
    await using var video = File.OpenRead(args[pos + 2]);
    var file = new Microsoft.AspNetCore.Http.FormFile(video, 0, video.Length, "Video", "short.mp4");
    var duration = await global::Task.Presentation.MissionMediaValidator.Duration(file, args[pos + 1], CancellationToken.None);
    Check(duration > 0 && duration < 5, "server reads actual short-video duration instead of client-supplied 5 seconds");
}
if (!args.Contains("--sql")) { Console.WriteLine("SQL integration SKIPPED; pass --sql <local-instance> to create an isolated test database."); return; }
var server = args[Array.IndexOf(args, "--sql") + 1];
if (!server.StartsWith(@".\", StringComparison.Ordinal) && server != "localhost") throw new Exception("Only an explicitly local SQL instance is permitted by this harness.");
var name = "DISA_OC3_TEST_" + Guid.NewGuid().ToString("N");
var connection = new SqlConnectionStringBuilder { DataSource = server, InitialCatalog = "master", IntegratedSecurity = true, TrustServerCertificate = true, ConnectTimeout = 10 };
await using (var master = new SqlConnection(connection.ConnectionString))
{ await master.OpenAsync(); await using var create = master.CreateCommand(); create.CommandText = $"CREATE DATABASE [{name}]"; await create.ExecuteNonQueryAsync(); }
connection.InitialCatalog = name;
Console.WriteLine("Isolated test database (kept for inspection): " + name);
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["PartnerVouchers:TokenKey"] = "TEST-ONLY-NOT-A-DEPLOYMENT-KEY-0123456789" }).Build();
TaskDbContext Db() => new(new DbContextOptionsBuilder<TaskDbContext>().UseSqlServer(connection.ConnectionString).Options);
PartnerVoucherService Service(TaskDbContext db) => new(db, config);
var location = new LocationSnapshot { Id = Guid.NewGuid(), PartnerId = Guid.NewGuid(), Name = "INTERNAL TEST VENUE", Active = true, Version = 1 };
var campaign = new Campaign { LocationId = location.Id, Title = "TEST ONLY", Terms = "Not a real offer", TotalQuota = 10, Status = "ACTIVE", ValidDays = 30, ClaimStartsAt = now.AddDays(-1), ClaimEndsAt = now.AddDays(2), RedeemEndsAt = now.AddDays(32), PercentageBps = 1000, DataMode = "INTERNAL_TEST" };
await using (var db = Db()) { await db.Database.MigrateAsync(); db.Add(location); db.Add(campaign); await db.SaveChangesAsync(); }
var travelers = Enumerable.Range(0, 50).Select(_ => Guid.NewGuid()).ToArray();
var claimResults = await System.Threading.Tasks.Task.WhenAll(travelers.Select(async user => {
    await using var db = Db();
    try { await Service(db).Claim(campaign.Id, user, Guid.NewGuid().ToString(), null); return true; }
    catch (VoucherError e) when (e.Code == "STOCK_EXHAUSTED") { return false; }
}));
Check(claimResults.Count(x => x) == 10, "50 simultaneous users -> exactly 10 claims");
var winner = travelers[Array.FindIndex(claimResults, x => x)];
await System.Threading.Tasks.Task.WhenAll(Enumerable.Range(0, 30).Select(async _ => { await using var db = Db(); await Service(db).Claim(campaign.Id, winner, Guid.NewGuid().ToString(), null); }));
Guid voucherId;
await using (var db = Db()) {
    Check(await db.Set<VoucherInstance>().CountAsync() == 10, "repeat claims do not consume more stock");
    Check((await db.Set<Campaign>().SingleAsync()).IssuedCount == 10, "quota counter matches records");
    voucherId = (await db.Set<VoucherInstance>().SingleAsync(v => v.TravelerId == winner)).Id;
}
static JsonElement J(object value) => JsonSerializer.SerializeToElement(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
string rawToken, shortCode;
await using (var db = Db()) { var p = J(await Service(db).Present(voucherId, winner)); rawToken = p.GetProperty("qrPayload").GetString()!; shortCode = p.GetProperty("shortCode").GetString()!; }
var staff = new[] { Guid.NewGuid(), Guid.NewGuid() }; var tickets = new string[2];
for (var i = 0; i < 2; i++) {
    await using var db = Db();
    var v = J(await Service(db).Verify(staff[i], location.Id, i == 0 ? rawToken : null, i == 0 ? null : shortCode, 200000, "TEST-ORDER"));
    tickets[i] = v.GetProperty("verificationTicket").GetString()!;
}
var redeemKeys = new[] { Guid.NewGuid().ToString(), Guid.NewGuid().ToString() };
var receipts = await System.Threading.Tasks.Task.WhenAll(Enumerable.Range(0, 2).Select(async i => {
    await using var db = Db();
    try { return J(await Service(db).Redeem(staff[i], tickets[i], redeemKeys[i])); }
    catch (VoucherError e) when (e.Code == "VOUCHER_ALREADY_REDEEMED") { return (JsonElement?)null; }
}));
Check(receipts.Count(x => x.HasValue) == 1, "two simultaneous staff confirms -> one redemption");
var winningStaff = Array.FindIndex(receipts, x => x.HasValue);
await using (var db = Db()) {
    var retry = J(await Service(db).Redeem(staff[winningStaff], tickets[winningStaff], redeemKeys[winningStaff]));
    Check(retry.GetProperty("redemptionId").GetString() == receipts[winningStaff]!.Value.GetProperty("redemptionId").GetString(), "same idempotency key returns original receipt");
    Check(await db.Set<Redemption>().CountAsync() == 1, "database contains exactly one redemption");
    Check((await db.Set<Campaign>().SingleAsync()).IssuedCount == 10, "redemption does not recycle quota");
    Check((await Service(db).Wallet(winner, "active", 1)).Length == 0, "used voucher removed from active wallet");
    Check((await Service(db).Wallet(winner, "history", 1)).Length == 1, "used voucher retained in history");
}
Console.WriteLine("SQL integration completed. No existing application database was modified.");
if (args.Contains("--http")) await HttpChecks.Run(server, connection.ConnectionString);
