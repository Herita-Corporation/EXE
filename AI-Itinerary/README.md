# AI-Itinerary Backend

This is the backend service for the DISA Travel AI-Itinerary feature. It is built with **FastAPI**, **PostgreSQL** (using `asyncpg` and `pgvector`), **Alembic** for database migrations, and **OpenAI** for AI generation.

## Prerequisites

Before you begin, ensure you have the following installed:
- Python 3.10+
- PostgreSQL (if running locally without Docker)
- Docker & Docker Compose (optional, but recommended for easy database setup)

---

## 🚀 Local Development Setup

### 1. Clone the repository
Navigate to the `AI-Itinerary` directory in your terminal:
```bash
cd AI-Itinerary
```

### 2. Create and activate a virtual environment
It is highly recommended to use a virtual environment to manage dependencies.

**On Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Setup Environment Variables
Copy the example environment file and configure your credentials:

**On Windows:**
```cmd
copy .env.example .env
```
**On macOS/Linux:**
```bash
cp .env.example .env
```

Open the newly created `.env` file and fill in your credentials, particularly:
- `DATABASE_URL` (e.g., `postgresql+asyncpg://user:password@localhost:5432/dbname`)
- `OPENAI_API_KEY`

---

## 🗄️ Database Setup & Migrations

If you are using Docker, you can quickly spin up a PostgreSQL instance using the provided compose file:
```bash
docker-compose up -d
```

Once the database is running and your `.env` is configured, apply the database migrations to create the necessary tables:
```bash
alembic upgrade head
```

---

## 🏃 Running the Application

To start the FastAPI development server, run:
```bash
uvicorn main:app --reload
```
- The API will be available at: `http://127.0.0.1:8000`
- Interactive API Documentation (Swagger UI) is available at: `http://127.0.0.1:8000/docs`
- ReDoc is available at: `http://127.0.0.1:8000/redoc`

---

## 🐳 Running with Docker

If you prefer to run the entire application (API + Database) via Docker, simply use:
```bash
docker-compose up --build
```

---

## 🧪 Testing

This project uses `pytest` for testing.

To run the full test suite:
```bash
pytest
```

To run tests with coverage reporting:
```bash
pytest --cov=app tests/
```
*(Make sure your testing database credentials are correct in your `.env` file or `pytest.ini` before running tests).*
