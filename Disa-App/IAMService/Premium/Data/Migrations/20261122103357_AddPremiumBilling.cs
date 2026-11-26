using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IAM.Presentation.Premium.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPremiumBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PremiumPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    PriceVnd = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    GoogleProductId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    AppleProductId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PremiumPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PremiumPayments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanId = table.Column<int>(type: "int", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AmountVnd = table.Column<int>(type: "int", nullable: false),
                    OrderCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ProviderTransactionId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StoreTokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaidAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AccessUntilUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PremiumPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PremiumPayments_PremiumPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "PremiumPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserPremiumSubscriptions",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    StartAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastPaymentId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPremiumSubscriptions", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_UserPremiumSubscriptions_PremiumPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "PremiumPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "PremiumPlans",
                columns: new[] { "Id", "AppleProductId", "Code", "DurationMonths", "GoogleProductId", "IsActive", "Name", "PriceVnd" },
                values: new object[,]
                {
                    { 1, "disa_premium_1m", "MONTHLY", 1, "disa_premium_1m", true, "DISA Premium 1 tháng", 29000 },
                    { 2, "disa_premium_6m", "HALF_YEAR", 6, "disa_premium_6m", true, "DISA Premium 6 tháng", 79000 },
                    { 3, "disa_premium_12m", "YEARLY", 12, "disa_premium_12m", true, "DISA Premium 12 tháng", 129000 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_PremiumPayments_OrderCode",
                table: "PremiumPayments",
                column: "OrderCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PremiumPayments_PlanId",
                table: "PremiumPayments",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_PremiumPayments_Provider_ProviderTransactionId",
                table: "PremiumPayments",
                columns: new[] { "Provider", "ProviderTransactionId" },
                unique: true,
                filter: "[ProviderTransactionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PremiumPayments_Provider_StoreTokenHash",
                table: "PremiumPayments",
                columns: new[] { "Provider", "StoreTokenHash" },
                unique: true,
                filter: "[StoreTokenHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PremiumPlans_Code",
                table: "PremiumPlans",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPremiumSubscriptions_PlanId",
                table: "UserPremiumSubscriptions",
                column: "PlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PremiumPayments");

            migrationBuilder.DropTable(
                name: "UserPremiumSubscriptions");

            migrationBuilder.DropTable(
                name: "PremiumPlans");
        }
    }
}
