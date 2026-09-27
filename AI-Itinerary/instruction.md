# AI-Itinerary Service Specification

Version: 2.0

Status: Production Ready

---

# 1. Executive Summary

## Project Name

AI-Itinerary Service

## Purpose

AI-Itinerary is an independent Python microservice responsible for generating personalized travel itineraries for users of the Disa platform.

Unlike traditional itinerary generators that rely entirely on external APIs at request time, AI-Itinerary uses a Retrieval-Augmented Generation (RAG) architecture.

The system combines:

* Tourism Knowledge Base
* Retrieval Layer
* Route Optimization Engine
* GPT-4o-mini Reasoning Layer

to produce accurate, cost-aware and geographically optimized travel plans.

---

# 2. High-Level Architecture

```text
User
│
▼
Disa Backend (.NET)
│
▼
AI-Itinerary Service (FastAPI)
│
├── Retrieval Layer
│
├── Route Optimization Layer
│
├── Budget Optimization Layer
│
├── GPT Orchestrator
│
└── Persistence Layer
│
▼
PostgreSQL + pgvector
│
▼
Tourism Knowledge Base
```

---

# 3. Core Design Principles

The system must:

1. Never exceed user budget.
2. Minimize travel distance.
3. Prefer highly-rated locations.
4. Generate explainable itineraries.
5. Avoid hallucinated recommendations.
6. Use only retrieved locations.
7. Produce deterministic JSON output.

---

# 4. Scope

The service is responsible for:

* Travel itinerary generation
* Budget planning
* Attraction recommendations
* Restaurant recommendations
* Accommodation recommendations
* Transportation recommendations
* Route optimization
* Cost estimation

The service is NOT responsible for:

* Payment processing
* Booking confirmation
* User authentication
* Notification delivery

Those responsibilities belong to Disa backend services.

---

# 5. Position In Disa Ecosystem

Architecture:

```text
Client
│
▼
API Gateway
│
▼
AITourService (.NET)
│
▼
AI-Itinerary (Python)
│
▼
Knowledge Base
```

AI-Itinerary is deployed independently and communicates with Disa backend through REST APIs.

---

# 6. Functional Requirements

## FR-01 Generate Itinerary

Input:

```json
{
  "user_id": "uuid",
  "cities": [
    "Da Nang",
    "Hoi An"
  ],
  "budget": 10000000,
  "start_date": "2027-01-01",
  "end_date": "2027-01-05"
}
```

Output:

Complete itinerary.

---

## FR-02 Budget Validation

Reject:

* budget <= 0
* start_date > end_date
* trip_duration <= 0

---

## FR-03 Multi-City Planning

Support:

```text
HCM
→ Da Nang
→ Hue
→ Hoi An
```

---

## FR-04 Route Optimization

The system must optimize:

* distance
* travel duration
* activity order

---

## FR-05 Daily Planning

Each day should include:

* breakfast
* attractions
* lunch
* attractions
* dinner
* accommodation

when applicable.

---

## FR-06 Transportation Recommendation

Support:

* airplane
* train
* sleeper bus
* taxi
* ride-hailing
* rental vehicle

---

## FR-07 Knowledge Base Retrieval

All recommendations must originate from the retrieval layer.

No location may be generated directly by GPT.

---

# 7. Non-Functional Requirements

## Performance

Target:

< 15 seconds

Maximum:

< 30 seconds

---

## Scalability

Support:

100 concurrent requests minimum.

---

## Availability

99.9%

---

## Security

Must support:

* HTTPS
* JWT validation
* API key protection
* Request throttling

---

## Logging

Use structured JSON logs.

Required fields:

```json
{
  "request_id": "",
  "user_id": "",
  "duration_ms": 0,
  "status": ""
}
```

---

# 8. Technology Stack

## Language

Python 3.12+

## Framework

FastAPI

## ORM

SQLAlchemy 2.x

## Validation

Pydantic v2

## Database

PostgreSQL

## Vector Database

pgvector

## Async

AsyncIO

httpx

## Testing

pytest

pytest-asyncio

## Containerization

Docker

Docker Compose

## AI Model

Primary:

GPT-4o-mini

Fallback:

GPT-4.1-mini

---

# 9. Retrieval-Augmented Architecture

The service follows a RAG workflow.

```text
User Request
│
▼
Retrieval Layer
│
▼
Candidate Locations
│
▼
GPT-4o-mini
│
▼
Itinerary JSON
```

GPT never searches the internet.

GPT never discovers places.

GPT only reasons using retrieved context.

---

# 10. Knowledge Base Architecture

The Knowledge Base stores:

* attractions
* restaurants
* hotels
* local experiences
* transportation nodes
* travel tips

Sources:

* OpenStreetMap
* Overpass API
* Internal crawlers
* Curated datasets

The Knowledge Base acts as the single source of truth.

---

# 11. Data Ingestion Layer

Separate ingestion jobs collect data.

```text
Crawler
│
▼
Raw Data
│
▼
Cleaning
│
▼
Normalization
│
▼
Knowledge Base
```

Jobs run on schedules.

Examples:

* daily
* weekly

depending on data source.

---

# 12. Data Quality Rules

Invalid records must be rejected.

Examples:

* missing coordinates
* invalid city
* missing name
* rating outside range

Accepted rating:

0.0 – 5.0

---

# 13. Rating Rules

Preferred:

rating >= 4.5

Fallback:

rating >= 4.0

If insufficient candidates exist, fallback mode is activated automatically.

---

# 14. Budget Planning Rules

Budget Allocation:

70% → planned expenses

30% → reserve

Example:

Budget:

10,000,000 VND

Planning Budget:

7,000,000 VND

Reserve:

3,000,000 VND

Formula:

```text
planning_budget = budget * 0.7

reserve_budget = budget * 0.3
```

---

# 15. Budget Categories

Budget must be distributed across:

* transportation
* accommodation
* food
* attractions
* contingency

The optimizer should attempt balanced allocation.

# 16. Database Architecture

## Overview

The AI-Itinerary service uses PostgreSQL as the primary datastore and pgvector for semantic retrieval.

Architecture:

```text
PostgreSQL
│
├── Operational Data
│
├── Knowledge Base
│
├── Generated Itineraries
│
└── Vector Embeddings
```

---

# 17. Core Tables

## ai_generated_itineraries

```sql
CREATE TABLE ai_generated_itineraries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    request_payload JSONB NOT NULL,
    generated_itinerary JSONB NOT NULL,
    total_cost NUMERIC(12,2),
    generation_time_ms INT,
    created_at TIMESTAMP NOT NULL
);
```

---

## ai_cache

```sql
CREATE TABLE ai_cache (
    id UUID PRIMARY KEY,
    cache_key TEXT UNIQUE,
    cache_value JSONB,
    expires_at TIMESTAMP,
    created_at TIMESTAMP
);
```

---

# 18. Knowledge Base Tables

## attractions

```sql
CREATE TABLE attractions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(255),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),

    rating DECIMAL(2,1),
    review_count INT,

    ticket_price NUMERIC(12,2),

    category VARCHAR(100),

    description TEXT,

    source VARCHAR(100),

    updated_at TIMESTAMP
);
```

---

## restaurants

```sql
CREATE TABLE restaurants (
    id UUID PRIMARY KEY,

    name VARCHAR(255),

    city VARCHAR(255),

    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),

    rating DECIMAL(2,1),

    review_count INT,

    avg_price NUMERIC(12,2),

    cuisine VARCHAR(100),

    source VARCHAR(100),

    updated_at TIMESTAMP
);
```

---

## hotels

```sql
CREATE TABLE hotels (
    id UUID PRIMARY KEY,

    name VARCHAR(255),

    city VARCHAR(255),

    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),

    rating DECIMAL(2,1),

    review_count INT,

    price_per_night NUMERIC(12,2),

    source VARCHAR(100),

    updated_at TIMESTAMP
);
```

---

# 19. Vector Tables

## attraction_embeddings

```sql
CREATE TABLE attraction_embeddings (
    attraction_id UUID PRIMARY KEY,
    embedding VECTOR(1536)
);
```

---

## restaurant_embeddings

```sql
CREATE TABLE restaurant_embeddings (
    restaurant_id UUID PRIMARY KEY,
    embedding VECTOR(1536)
);
```

---

## hotel_embeddings

```sql
CREATE TABLE hotel_embeddings (
    hotel_id UUID PRIMARY KEY,
    embedding VECTOR(1536)
);
```

---

# 20. Folder Structure

```text
AI-Itinerary/

├── app/

├── api/
│   ├── routes/
│   │   ├── itinerary.py
│   │   ├── retrieval.py
│   │   └── health.py

├── core/
│   ├── config.py
│   ├── logging.py
│   ├── exceptions.py
│   ├── constants.py
│   └── security.py

├── database/
│   ├── session.py
│   ├── models/
│   ├── repositories/

├── schemas/
│   ├── request.py
│   ├── response.py
│   ├── itinerary.py

├── services/
│   ├── itinerary_service.py
│   ├── retrieval_service.py
│   ├── budget_service.py
│   ├── recommendation_service.py

├── planners/
│   ├── route_optimizer.py
│   ├── budget_optimizer.py
│   ├── itinerary_builder.py

├── orchestrators/
│   ├── itinerary_orchestrator.py

├── integrations/
│   ├── openai_client.py
│   ├── osm_client.py
│   ├── overpass_client.py
│   ├── osrm_client.py

├── data/
│   ├── crawlers/
│   │   ├── attraction_crawler.py
│   │   ├── restaurant_crawler.py
│   │   └── hotel_crawler.py

│   ├── ingestion/
│   │   ├── attraction_ingestion.py
│   │   ├── restaurant_ingestion.py
│   │   └── hotel_ingestion.py

│   └── knowledge_base/

├── prompts/
│   ├── itinerary_prompt.txt

├── tests/

├── alembic/

├── main.py

├── requirements.txt

├── Dockerfile

└── docker-compose.yml
```

---

# 21. Retrieval Layer

The Retrieval Layer is responsible for finding candidate locations.

Inputs:

* cities
* budget
* trip duration
* preferences

Outputs:

* candidate attractions
* candidate restaurants
* candidate hotels

---

# 22. Retrieval Flow

```text
User Request
│
▼
Filter By City
│
▼
Filter By Rating
│
▼
Filter By Budget
│
▼
Distance Analysis
│
▼
Top-K Retrieval
│
▼
Candidate Context
```

---

# 23. Candidate Selection Rules

Attractions:

Top 20

Restaurants:

Top 20

Hotels:

Top 10

Maximum GPT Context:

50 entities

---

# 24. Route Optimization Engine

Purpose:

Minimize travel time.

Minimize transportation costs.

Improve itinerary quality.

---

# 25. Route Optimization Inputs

```json
{
  "locations": [],
  "coordinates": [],
  "travel_mode": "car"
}
```

---

# 26. Route Optimization Outputs

```json
{
  "ordered_locations": [],
  "estimated_distance": 0,
  "estimated_duration": 0
}
```

---

# 27. OSRM Integration

OSRM provides:

* distance matrix
* travel duration
* route optimization

No Google Directions API is required.

---

# 28. OpenAI Integration

Primary Model:

GPT-4o-mini

Purpose:

* itinerary reasoning
* schedule generation
* budget balancing

GPT is NOT responsible for:

* searching locations
* finding hotels
* geocoding

These responsibilities belong to the retrieval layer.

---

# 29. GPT Context Construction

Input Context:

```json
{
  "trip_information": {},
  "candidate_hotels": [],
  "candidate_restaurants": [],
  "candidate_attractions": []
}
```

Only retrieved entities may be included.

No external knowledge is allowed.

---

# 30. Anti-Hallucination Policy

GPT MUST NOT:

* invent attractions
* invent restaurants
* invent hotels
* invent ratings
* invent prices

Every recommendation must originate from the retrieval layer.

Any generated location not present in the supplied context is invalid.

# 31. Itinerary Generation Pipeline

The itinerary generation process follows a deterministic workflow.

```text
Step 1
Validate Request

↓

Step 2
Calculate Planning Budget

↓

Step 3
Retrieve Candidate Hotels

↓

Step 4
Retrieve Candidate Restaurants

↓

Step 5
Retrieve Candidate Attractions

↓

Step 6
Apply Rating Filters

↓

Step 7
Calculate Route Distances

↓

Step 8
Optimize Route

↓

Step 9
Build GPT Context

↓

Step 10
Generate Itinerary

↓

Step 11
Validate Budget

↓

Step 12
Validate Schedule

↓

Step 13
Persist Result

↓

Step 14
Return Response
```

---

# 32. Request Validation

The system must validate:

## Budget

```text
budget > 0
```

---

## Dates

```text
start_date <= end_date
```

---

## Trip Duration

```text
trip_duration > 0
```

---

## Cities

At least one city must be supplied.

```text
cities.length >= 1
```

---

# 33. GPT Prompting Rules

The GPT prompt must be treated as a system-level contract.

---

## Rule 1

Never exceed planning budget.

```text
total_cost <= planning_budget
```

---

## Rule 2

Prefer shorter travel distances.

---

## Rule 3

Prefer higher-rated locations.

---

## Rule 4

Maintain chronological ordering.

---

## Rule 5

Avoid duplicate attractions.

---

## Rule 6

Avoid impossible schedules.

Example:

```text
08:00 Da Nang

08:30 HCM

09:00 Hue
```

Invalid.

---

## Rule 7

Use only provided entities.

---

## Rule 8

Return JSON only.

No Markdown.

No explanations.

No prose.

---

# 34. Example System Prompt

```text
You are an itinerary planning assistant.

You are given:

1. User trip information
2. Candidate attractions
3. Candidate restaurants
4. Candidate hotels

You must:

- stay within budget
- optimize travel time
- maximize experience quality
- use ONLY supplied entities

You must never invent locations.

Output valid JSON only.
```

---

# 35. Itinerary Validation

Generated itineraries must pass validation.

---

## Budget Validation

```text
total_cost <= planning_budget
```

---

## Time Validation

Every activity must satisfy:

```text
start_time < end_time
```

---

## Overlap Validation

Activities must not overlap.

---

## Location Validation

Every location must exist in retrieval results.

---

# 36. API Specification

Base URL:

```text
/api/v1
```

---

# 37. POST /itinerary/generate

Purpose:

Generate itinerary.

---

## Request

```json
{
  "user_id": "uuid",
  "cities": [
    "Da Nang",
    "Hoi An"
  ],
  "budget": 10000000,
  "start_date": "2027-01-01",
  "end_date": "2027-01-05",
  "preferences": [
    "food",
    "culture"
  ]
}
```

---

## Response

```json
{
  "itinerary_id": "uuid",
  "total_cost": 6500000,
  "days": []
}
```

---

# 38. GET /itinerary/{id}

Purpose:

Retrieve itinerary.

---

## Response

```json
{
  "id": "",
  "created_at": "",
  "trip_summary": {},
  "days": []
}
```

---

# 39. DELETE /itinerary/{id}

Purpose:

Delete itinerary.

---

## Response

```json
{
  "success": true
}
```

---

# 40. GET /health

Purpose:

Health check.

---

## Response

```json
{
  "status": "healthy"
}
```

---

# 41. Output Schema

The itinerary must follow a strict schema.

```json
{
  "trip_summary": {
    "start_date": "",
    "end_date": "",
    "budget": 0,
    "planning_budget": 0,
    "reserve_budget": 0
  },

  "days": [
    {
      "date": "",
      "city": "",
      "activities": [
        {
          "start_time": "",
          "end_time": "",
          "type": "",
          "name": "",
          "cost": 0,
          "rating": 0
        }
      ]
    }
  ],

  "total_cost": 0
}
```

---

# 42. Activity Types

Allowed values:

```text
transportation
breakfast
lunch
dinner
attraction
hotel
shopping
experience
```

---

# 43. Cost Calculation

Total cost must be computed from:

```text
transportation_cost

+

accommodation_cost

+

food_cost

+

attraction_cost
```

---

# 44. Caching Strategy

Purpose:

Reduce GPT usage.

Reduce database load.

Reduce latency.

---

## Cache Keys

Example:

```text
city=DaNang

duration=5

budget=10000000

preferences=food,culture
```

---

## Cache Expiration

Recommended:

```text
24 hours
```

---

## Cached Objects

Store:

* retrieval results
* generated itineraries
* route optimization results

---

# 45. Error Handling

All errors must follow a standard structure.

```json
{
  "success": false,
  "error_code": "INVALID_BUDGET",
  "message": "Budget must be greater than zero."
}
```

---

# 46. Standard Error Codes

```text
INVALID_BUDGET

INVALID_DATE

INVALID_CITY

NO_CANDIDATES_FOUND

GPT_GENERATION_FAILED

DATABASE_ERROR

CACHE_ERROR

UNKNOWN_ERROR
```

---

# 47. Observability

The service must expose metrics.

Recommended:

```text
Prometheus
```

Metrics:

```text
request_count

request_duration

cache_hit_rate

gpt_token_usage

generation_time
```

---

# 48. Structured Logging

Example:

```json
{
  "request_id": "",
  "user_id": "",
  "endpoint": "",
  "duration_ms": 0,
  "status": "success"
}
```

---

# 49. Rate Limiting

Recommended:

```text
60 requests / minute
```

per API key.

---

# 50. Security Requirements

Must support:

* HTTPS
* JWT validation
* Request signing
* API key validation
* CORS restrictions

Sensitive information must never be logged.

# 51. Deployment Architecture

The AI-Itinerary service must be fully containerized.

Deployment target:

* Linux Server
* VPS
* Cloud VM
* Kubernetes Cluster

---

# 52. Docker Architecture

```text
Client
│
▼
API Gateway
│
▼
AI-Itinerary Container
│
├── FastAPI
├── Retrieval Layer
├── GPT Orchestrator
├── Route Optimizer
│
▼
PostgreSQL + pgvector
```

---

# 53. Docker Requirements

The service must include:

```text
Dockerfile

docker-compose.yml

.env

.env.example
```

---

# 54. Dockerfile Requirements

The Docker image must:

* Use Python 3.12+
* Run as non-root user
* Support health checks
* Support graceful shutdown

---

# 55. Docker Compose Services

Required services:

```text
ai-itinerary

postgres

pgadmin (optional)
```

---

Example:

```yaml
version: "3.9"

services:

  ai-itinerary:
    build: .
    ports:
      - "8000:8000"

  postgres:
    image: postgres:16

  pgadmin:
    image: dpage/pgadmin4
```

---

# 56. Environment Variables

## Database

```env
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
```

---

## OpenAI

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

---

## Routing

```env
OSRM_URL=
OVERPASS_URL=
```

---

## Optional Providers

```env
AMADEUS_API_KEY=
AMADEUS_API_SECRET=
```

---

## Cache

```env
CACHE_TTL_HOURS=24
```

---

## Security

```env
JWT_SECRET=

JWT_ALGORITHM=HS256

API_KEY=
```

---

# 57. Configuration Management

Configuration must be centralized.

Example:

```text
core/config.py
```

All settings must be loaded using:

```text
Pydantic Settings
```

Hardcoded secrets are forbidden.

---

# 58. CI/CD Pipeline

The service must support automated deployment.

Recommended workflow:

```text
Git Push

↓

Unit Tests

↓

Integration Tests

↓

Docker Build

↓

Security Scan

↓

Deploy
```

---

# 59. GitHub Actions Pipeline

Minimum stages:

```text
lint

↓

test

↓

build

↓

deploy
```

---

# 60. Code Quality Standards

The project must follow:

* SOLID
* Clean Architecture
* DDD Principles
* Separation of Concerns

---

# 61. Naming Conventions

## Files

```text
snake_case
```

Example:

```text
budget_service.py

route_optimizer.py
```

---

## Classes

```text
PascalCase
```

Example:

```python
class BudgetService:
    pass
```

---

## Variables

```text
snake_case
```

Example:

```python
planning_budget
trip_duration
```

---

# 62. Dependency Injection

Services must not instantiate dependencies directly.

Bad:

```python
service = OpenAIClient()
```

Preferred:

```python
service = Depends(get_openai_client)
```

---

# 63. Async Requirements

All external operations must be asynchronous.

Examples:

* database access
* HTTP requests
* OpenAI requests

Use:

```python
async def
```

where appropriate.

---

# 64. Testing Strategy

The service must include:

## Unit Tests

Coverage target:

80%+

Test:

* BudgetService
* RetrievalService
* RouteOptimizer
* Validators

---

## Integration Tests

Test:

* PostgreSQL integration
* OpenAI integration
* OSRM integration

---

## API Tests

Test:

```text
POST /generate

GET /itinerary

DELETE /itinerary
```

---

# 65. Test Data

Seed data should be available.

Examples:

```text
Da Nang Attractions

Hoi An Attractions

HCM Attractions
```

The service must be runnable locally without production data.

---

# 66. Performance Requirements

## Target Latency

```text
< 15 seconds
```

---

## Maximum Latency

```text
< 30 seconds
```

---

## Retrieval Query Time

```text
< 500 ms
```

---

## Route Optimization

```text
< 2 seconds
```

---

## GPT Generation

```text
< 10 seconds
```

---

# 67. Reliability Requirements

The service must remain operational if:

* OpenAI temporarily fails
* OSRM temporarily fails
* cache is unavailable

Fallback mechanisms must exist.

---

# 68. GPT Failure Recovery

If GPT generation fails:

```text
Retry #1

↓

Retry #2

↓

Fallback Response
```

Maximum retries:

```text
2
```

---

# 69. Cache Failure Recovery

If cache fails:

```text
Continue execution

Log warning
```

The request must not fail.

---

# 70. Database Failure Recovery

If PostgreSQL is unavailable:

```text
Return HTTP 503
```

Response:

```json
{
  "success": false,
  "error_code": "DATABASE_UNAVAILABLE"
}
```

---

# 71. Production Prompting Policy

GPT MUST:

* stay within budget
* optimize travel time
* maximize experience quality
* use supplied locations only

---

GPT MUST NOT:

* invent attractions
* invent restaurants
* invent hotels
* invent ratings
* invent prices
* invent opening hours

---

# 72. Retrieval-Only Policy

All entities returned by GPT must exist in:

```text
candidate_attractions

candidate_restaurants

candidate_hotels
```

Any entity outside these sets is invalid.

---

# 73. Acceptance Criteria

The implementation is accepted only if:

1. FastAPI service runs successfully.
2. PostgreSQL integration works.
3. pgvector integration works.
4. OpenAI integration works.
5. OSRM integration works.
6. Retrieval layer works.
7. GPT uses retrieval results only.
8. Generated itinerary is valid JSON.
9. Budget never exceeds planning budget.
10. Route optimization works.
11. Docker deployment succeeds.
12. Swagger documentation is generated.
13. Test coverage exceeds 80%.
14. Service supports 100 concurrent users.
15. Production logging is enabled.

---

# 74. Future Roadmap

## Phase 2

Personalization

Features:

* travel preferences
* travel history
* dietary restrictions
* accommodation preferences

---

## Phase 3

Advanced RAG

Features:

* vector search
* travel guides
* hidden gems
* local recommendations

---

## Phase 4

Multi-Agent Planning

Agents:

```text
Budget Agent

Route Agent

Food Agent

Accommodation Agent

Attraction Agent
```

---

## Phase 5

Real-Time Adaptation

Features:

* weather-aware itinerary
* traffic-aware routing
* dynamic re-planning
* live event recommendations

---

# 75. Production Readiness Checklist

Before release:

* [ ] FastAPI implemented
* [ ] PostgreSQL connected
* [ ] pgvector configured
* [ ] Alembic migrations created
* [ ] OpenAI integrated
* [ ] OSRM integrated
* [ ] Retrieval layer implemented
* [ ] Route optimizer implemented
* [ ] Budget validator implemented
* [ ] Structured logging enabled
* [ ] Health endpoint enabled
* [ ] Dockerized
* [ ] CI/CD configured
* [ ] Unit tests passing
* [ ] Integration tests passing
* [ ] API tests passing
* [ ] Security review completed
* [ ] Performance benchmarks completed

---

# 76. Final Architecture

```text
User
│
▼
Disa Backend (.NET)
│
▼
AI-Itinerary Service
│
├── Request Validation
│
├── Retrieval Layer
│
├── Budget Optimizer
│
├── Route Optimizer
│
├── GPT Orchestrator
│
├── Cache Layer
│
└── Persistence Layer
│
▼
PostgreSQL + pgvector
│
▼
Tourism Knowledge Base
│
├── Attractions
│
├── Restaurants
│
├── Hotels
│
└── Experiences
│
▼
OpenStreetMap + Overpass
```

---

# END OF DOCUMENT

Version: 2.0

Status: Production Ready

This document serves as the authoritative specification for the implementation of the AI-Itinerary Service within the Disa ecosystem.