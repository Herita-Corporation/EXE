# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile for Task.Presentation (.NET 8) — mission/gamification service
# Build context: Disa-App/ directory
# ──────────────────────────────────────────────────────────────────────────────

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files for restore (order: Domain → Application → Infrastructure → Presentation)
COPY ["Task.Presentation/Task.Presentation.csproj", "Task.Presentation/"]
COPY ["Task.Infrastructure/Task.Infrastructure.csproj", "Task.Infrastructure/"]
COPY ["Task.Application/Task.Application.csproj", "Task.Application/"]
COPY ["Task.Domain/Task.Domain.csproj", "Task.Domain/"]

RUN dotnet restore "Task.Presentation/Task.Presentation.csproj"

# Copy all source
COPY . .

WORKDIR "/src/Task.Presentation"
RUN dotnet build "Task.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Task.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Task.Presentation.dll"]
