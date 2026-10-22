# Local Docker Setup

This guide describes how to run the FoodConnect web application and domain services locally using the root `docker-compose.yml`.

## Requirements

- Docker Desktop with Docker Compose enabled
- Git

## Start the stack

From the repository root:

```bash
docker compose up --build
```

Compose starts:

| Component | Local URL/port |
| --- | --- |
| Next.js frontend | `http://localhost:3000` |
| Backend API | `http://localhost:3001` |
| Identity service | `http://localhost:3002` |
| Provider service | `http://localhost:3003` |
| Order service | `http://localhost:3004` |
| DynamoDB Local | `http://localhost:8000` |

Open `http://localhost:3000` in a browser. Compose sets the local development values and fake AWS credentials used by DynamoDB Local.

## Verify service health

The Compose configuration defines health checks for the backend and domain services. You can also request the health routes:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

Check container state and logs with:

```bash
docker compose ps
docker compose logs -f
```

## Stop the stack

```bash
docker compose down
```

The `dynamodb-data` named volume preserves local database files. `docker compose down -v` removes that volume and its local data.

## Notes

- Root Compose enables DynamoDB table auto-creation and supplies the local service endpoint configuration.
- Compose uses fake AWS credentials for DynamoDB Local.
