# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile for IAMService / IAM.Presentation (.NET 8)
# Build context: Disa-App/ directory
# ──────────────────────────────────────────────────────────────────────────────

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files for restore (order: Infrastructure → Application → Presentation)
COPY ["IAMService/IAM.Presentation.csproj", "IAMService/"]
COPY ["IAM.Domain/IAM.Domain.csproj", "IAM.Domain/"]
COPY ["IAM.Application/IAM.Application.csproj", "IAM.Application/"]
COPY ["IAM.Infrastructure/IAM.Infrastructure.csproj", "IAM.Infrastructure/"]
COPY ["Common/Common.csproj", "Common/"]

RUN dotnet restore "IAMService/IAM.Presentation.csproj"

# Copy all source
COPY . .

WORKDIR "/src/IAMService"
RUN dotnet build "IAM.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "IAM.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "IAM.Presentation.dll"]
