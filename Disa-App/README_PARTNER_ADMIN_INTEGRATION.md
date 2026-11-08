# DISA Travel — full source with Partner/Admin API integration

This archive contains the original Disa-App source tree extracted from Disa-App(2).rar, with the partner/admin entity patch and five new API controllers integrated into the existing IAMService project. The original IAMService AuthController, Google Login, Program.cs and other microservices are preserved.

## Run
1. Restore your local SQL Server configuration and JWT secrets through user-secrets or environment variables.
2. Review database schema changes for PartnerProfiles, PartnerContentRequests, PartnerRequestImages, PartnerInvoices, PartnerReviewAudits before starting the API. The source does not include a validated EF migration for an existing production database.
3. From the Disa-App folder: `dotnet restore IAMService/IAM.Presentation.csproj` then `dotnet build IAMService/IAM.Presentation.csproj` then `dotnet run --project IAMService/IAM.Presentation.csproj`.
4. Verify Swagger and authentication for Admin and Partner roles.

## Added files
IAMService/Controllers/PartnerAuthController.cs, PartnerController.cs, PartnerRequestController.cs, AdminPartnerController.cs, InvoiceController.cs; IAM.Infrastructure/Data/Entities/PartnerProfile.cs, PartnerContentRequest.cs, PartnerRequestImage.cs, PartnerInvoice.cs, PartnerReviewAudit.cs. IAMDbContext.cs and SeedData.cs updated.

## Important limitations
This package has NOT been compiled or integration-tested in this environment (dotnet CLI unavailable). The supplied patch controllers are an initial implementation; validate role claims, request transitions, database migration, invoice permissions, uploads and frontend integration before production use. The original SeedData contains a development default administrator password: replace it before deployment.
