# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile for AITour.Presentation (.NET 8)
# Build context: Disa-App/ directory
# ──────────────────────────────────────────────────────────────────────────────

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files for restore (Infrastructure first, then Application, then Presentation)
COPY ["AITour.Presentation/AITour.Presentation.csproj", "AITour.Presentation/"]
COPY ["AITour.Application/AITour.Application.csproj", "AITour.Application/"]
COPY ["AITour.Infrastructure/AITour.Infrastructure.csproj", "AITour.Infrastructure/"]
COPY ["AITour.Domain/AITour.Domain.csproj", "AITour.Domain/"]

RUN dotnet restore "AITour.Presentation/AITour.Presentation.csproj"

# Copy all source
COPY . .

WORKDIR "/src/AITour.Presentation"
RUN dotnet build "AITour.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "AITour.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "AITour.Presentation.dll"]
