# Disa-App: Project Landscape & Overview

Disa-App is a software system structured around C# .NET 8, employing Clean Architecture and Domain-Driven Design (DDD) patterns. The architecture is designed as a modular monolith or microservice-based system, consisting of multiple bounded contexts (services), a shared building block layer, and an API Gateway.

---

## 1. Project Architecture

The codebase follows the principles of Clean Architecture, separating concerns into distinct layers to enforce dependency rules where the core domain logic has no dependencies on external frameworks, databases, or UI layers.

For each major service boundary, the project is divided into four standard layers:
*   **Domain**: Contains the core business logic, including entities, aggregates, value objects, domain events, domain services, and repository interfaces. It has zero external dependencies.
*   **Application**: Implements the use cases of the system. It handles command/query routing (typically via MediatR), validation, mapping, and defines interfaces for external infrastructure dependencies.
*   **Infrastructure**: Implements the technical details such as database access (e.g., Entity Framework Core), caching, external API integrations, file storage, and security providers.
*   **Presentation**: Exposes the application features to clients via web APIs, handling HTTP requests, controller definitions, routing, and serialization.

---

## 2. Services & Bounded Contexts

The solution defines the following services, representing different business domains:

### 2.1. APIGateway & Entry Point
*   **Disa**: Situated in the `APIGateway.Presentation` solution folder. It acts as the central host/gateway for public access, routing incoming client requests to their respective backend handlers.

### 2.2. Core Services
*   **IAMService (Identity & Access Management)**
    *   *Projects*: `IAM.Domain`, `IAM.Application`, `IAM.Infrastructure`, `IAM.Presentation` (under `IAMService` folder).
    *   *Responsibility*: Manages user identities, authentication, authorization, role management, and token generation.
*   **CustomerService**
    *   *Projects*: `Customer.Domain`, `Customer.Applicstion` *(note: misspelled folder name)*, `Customer.Infrastructure`, `Customer.Presentation`.
    *   *Responsibility*: Manages customer profiles, account information, preferences, and customer-specific configurations.
*   **BookingService**
    *   *Projects*: `Booking.Domain`, `Booking.Application`, `Booking.Infrastructure`, `Booking.Presentation`.
    *   *Responsibility*: Governs reservations, booking transactions, availability checks, and scheduling logic.
*   **AIService**
    *   *Projects*: `AI.Domain`, `AI.Application`, `AI.Infrastructure`, `AI.Presentation`.
    *   *Responsibility*: Integrates artificial intelligence capabilities, offering features like personalization, smart analysis, and recommendation engines.
*   **AITourService**
    *   *Projects*: `AITour.Domain`, `AITour.Application`, `AITour.Infrastructure`, `AITour.Presentation`.
    *   *Responsibility*: Focuses specifically on AI-driven travel planning, automated itinerary generation, and route recommendations.
*   **BlogService**
    *   *Projects*: `Blog.Domain`, `Blog.Application`, `Blog.Infrastructure`, `Blog.Presentation`.
    *   *Responsibility*: Handles content management, including travel blogs, articles, user reviews, comments, and rating mechanisms.
*   **TaskService**
    *   *Projects*: `Task.Domain`, `Task.Application`, `Task.Infrastructure`, `Task.Presentation`.
    *   *Responsibility*: Manages background jobs, task assignments, automated actions, and reminders within the ecosystem.

---

## 3. Shared Building Blocks

Shared infrastructure resides in the `building-block` folder to facilitate consistency and reusability across services:
*   **Common**: Holds cross-cutting utilities, generic helper methods, custom base exceptions, and core helper types utilized by all other service layers.
*   **Contracts**: Defines data contracts, shared models, API transfer shapes (DTOs), and event payloads that need to be parsed or exchanged across services.
*   **EventBus**: Provides the messaging infrastructure (such as wrappers for MassTransit, RabbitMQ, or Kafka) allowing asynchronous, decoupled communication between bounded contexts using event publication and subscription.

---

## 4. Physical Solution Layout

Below is the directory map of the solution corresponding to its logical modules:

```text
Disa-App/
│
├── Disa.sln                       # Solution entry file
│
├── Disa/                          # APIGateway / Web API Host
│
├── Common/                        # Core common libraries
├── Contracts/                     # Shared event & DTO contracts
├── EventBus/                      # Decoupled messaging infrastructure
│
├── IAMService/                    # Identity service (IAM.Presentation project)
├── IAM.Domain/
├── IAM.Application/
├── IAM.Infrastructure/
│
├── Customer.Presentation/         # Customer profile service
├── Customer.Domain/
├── Customer.Applicstion/          # Application layer (spelling as initialized)
├── Customer.Infrastructure/
│
├── Booking.Presentation/          # Booking service
├── Booking.Domain/
├── Booking.Application/
├── Booking.Infrastructure/
│
├── AI.Presentation/               # AI capabilities
├── AI.Domain/
├── AI.Application/
├── AI.Infrastructure/
│
├── AITour.Presentation/           # AI Tour generation
├── AITour.Domain/
├── AITour.Application/
├── AITour.Infrastructure/
│
├── Blog.Presentation/             # Blogs & reviews
├── Blog.Domain/
├── Blog.Application/
├── Blog.Infrastructure/
│
└── Task.Presentation/             # Tasks & background jobs
    ├── Task.Domain/
    ├── Task.Application/
    ├── Task.Infrastructure/
```

---

## 5. Technology Stack & Current Status

*   **Runtime & Framework**: C# .NET 8.0, ASP.NET Core Web API.
*   **API Documentation**: Swagger/OpenAPI configured using `Swashbuckle.AspNetCore` across all presentation endpoints.
*   **Architecture Pattern**: Clean Architecture with Domain-Driven Design (DDD) structuring.
*   **Development Stage**: The project is currently at an initialized boilerplate stage. The directories, project structures, and configuration files are generated and linked in `Disa.sln`. Each `.Presentation` layer is initialized as a running Web API template containing default controllers (`WeatherForecastController.cs`) and startup logic (`Program.cs`), providing a clean scaffolding to implement business-specific domain entities, business logic, databases, and message handlers.
