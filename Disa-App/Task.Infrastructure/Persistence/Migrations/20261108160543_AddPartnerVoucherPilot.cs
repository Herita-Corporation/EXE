using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Task.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPartnerVoucherPilot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "pv");

            migrationBuilder.CreateTable(
                name: "AcquisitionContexts",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    BoundUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcquisitionContexts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BusinessEvents",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    DataMode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IdempotencyRecords",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Operation = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ResponseJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IdempotencyRecords", x => x.Id);
                });


            migrationBuilder.CreateTable(
                name: "PartnerLocationSnapshots",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Address = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Latitude = table.Column<decimal>(type: "decimal(10,7)", precision: 10, scale: 7, nullable: false),
                    Longitude = table.Column<decimal>(type: "decimal(10,7)", precision: 10, scale: 7, nullable: false),
                    TimeZone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartnerLocationSnapshots", x => x.Id);
                });


            migrationBuilder.CreateTable(
                name: "SupportTickets",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoucherId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportTickets", x => x.Id);
                });



            migrationBuilder.CreateTable(
                name: "Campaigns",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Terms = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DiscountType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PercentageBps = table.Column<int>(type: "int", nullable: false),
                    FixedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxDiscountAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MinSpend = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    UsageMode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ValidDays = table.Column<int>(type: "int", nullable: false),
                    AllowedSources = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DataMode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TotalQuota = table.Column<int>(type: "int", nullable: false),
                    IssuedCount = table.Column<int>(type: "int", nullable: false),
                    RedeemedCount = table.Column<int>(type: "int", nullable: false),
                    ClaimStartsAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClaimEndsAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RedeemEndsAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    QrKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Campaigns", x => x.Id);
                    table.CheckConstraint("CK_PvQuota", "[IssuedCount]>=0 AND [RedeemedCount]>=0 AND [TotalQuota]>=[IssuedCount] AND [IssuedCount]>=[RedeemedCount]");
                    table.ForeignKey(
                        name: "FK_Campaigns_PartnerLocationSnapshots_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "pv",
                        principalTable: "PartnerLocationSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });



            migrationBuilder.CreateTable(
                name: "VoucherInstances",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TravelerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoucherRef = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IssuedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RedeemableFrom = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RedeemedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TermsSnapshotJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoucherInstances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VoucherInstances_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "pv",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });


            migrationBuilder.CreateTable(
                name: "Redemptions",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoucherInstanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReceiptRef = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OrderRef = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EligibleSubtotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    NetAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    RedeemedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Voided = table.Column<bool>(type: "bit", nullable: false),
                    VoidReason = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Redemptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Redemptions_VoucherInstances_VoucherInstanceId",
                        column: x => x.VoucherInstanceId,
                        principalSchema: "pv",
                        principalTable: "VoucherInstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VoucherPresentations",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoucherInstanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ShortCodeHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoucherPresentations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VoucherPresentations_VoucherInstances_VoucherInstanceId",
                        column: x => x.VoucherInstanceId,
                        principalSchema: "pv",
                        principalTable: "VoucherInstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VoucherVerifications",
                schema: "pv",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PresentationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Subtotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderRef = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoucherVerifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VoucherVerifications_VoucherPresentations_PresentationId",
                        column: x => x.PresentationId,
                        principalSchema: "pv",
                        principalTable: "VoucherPresentations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AcquisitionContexts_TokenHash",
                schema: "pv",
                table: "AcquisitionContexts",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BusinessEvents_EventType_OccurredAt",
                schema: "pv",
                table: "BusinessEvents",
                columns: new[] { "EventType", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Campaigns_LocationId",
                schema: "pv",
                table: "Campaigns",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_Campaigns_QrKey",
                schema: "pv",
                table: "Campaigns",
                column: "QrKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IdempotencyRecords_ActorId_Operation_Key",
                schema: "pv",
                table: "IdempotencyRecords",
                columns: new[] { "ActorId", "Operation", "Key" },
                unique: true);




            migrationBuilder.CreateIndex(
                name: "IX_Redemptions_VoucherInstanceId",
                schema: "pv",
                table: "Redemptions",
                column: "VoucherInstanceId",
                unique: true);



            migrationBuilder.CreateIndex(
                name: "IX_VoucherInstances_CampaignId_TravelerId",
                schema: "pv",
                table: "VoucherInstances",
                columns: new[] { "CampaignId", "TravelerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoucherInstances_TravelerId_Status_ExpiresAt",
                schema: "pv",
                table: "VoucherInstances",
                columns: new[] { "TravelerId", "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_VoucherInstances_VoucherRef",
                schema: "pv",
                table: "VoucherInstances",
                column: "VoucherRef",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoucherPresentations_ShortCodeHash",
                schema: "pv",
                table: "VoucherPresentations",
                column: "ShortCodeHash",
                unique: true,
                filter: "[Status]='ACTIVE'");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherPresentations_TokenHash",
                schema: "pv",
                table: "VoucherPresentations",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoucherPresentations_VoucherInstanceId",
                schema: "pv",
                table: "VoucherPresentations",
                column: "VoucherInstanceId",
                unique: true,
                filter: "[Status]='ACTIVE'");



            migrationBuilder.CreateIndex(
                name: "IX_VoucherVerifications_PresentationId",
                schema: "pv",
                table: "VoucherVerifications",
                column: "PresentationId");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherVerifications_TicketHash",
                schema: "pv",
                table: "VoucherVerifications",
                column: "TicketHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AcquisitionContexts",
                schema: "pv");

            migrationBuilder.DropTable(
                name: "BusinessEvents",
                schema: "pv");

            migrationBuilder.DropTable(
                name: "IdempotencyRecords",
                schema: "pv");



            migrationBuilder.DropTable(
                name: "Redemptions",
                schema: "pv");

            migrationBuilder.DropTable(
                name: "SupportTickets",
                schema: "pv");


            migrationBuilder.DropTable(
                name: "VoucherVerifications",
                schema: "pv");



            migrationBuilder.DropTable(
                name: "VoucherPresentations",
                schema: "pv");


            migrationBuilder.DropTable(
                name: "VoucherInstances",
                schema: "pv");


            migrationBuilder.DropTable(
                name: "Campaigns",
                schema: "pv");

            migrationBuilder.DropTable(
                name: "PartnerLocationSnapshots",
                schema: "pv");
        }
    }
}
