using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IAM.Presentation.Premium.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSePayReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SePayIncomingTransactions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Environment = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    SePayTransactionId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BankAccount = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TransferContent = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    OrderCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AmountVnd = table.Column<int>(type: "int", nullable: false),
                    PaymentId = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ReceivedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SePayIncomingTransactions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SePayIncomingTransactions_Environment_SePayTransactionId",
                table: "SePayIncomingTransactions",
                columns: new[] { "Environment", "SePayTransactionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SePayIncomingTransactions_PaymentId",
                table: "SePayIncomingTransactions",
                column: "PaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_SePayIncomingTransactions_ReceivedAtUtc",
                table: "SePayIncomingTransactions",
                column: "ReceivedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_SePayIncomingTransactions_Status",
                table: "SePayIncomingTransactions",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SePayIncomingTransactions");
        }
    }
}
