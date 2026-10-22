# AI Example Service

This Flask service exposes a health check and a sample forecast response. The forecast endpoint returns the fixed example values in `app.py`.

## Run with Docker

Build and run the image from the repository root:

```bash
docker build -t foodconnect-ai-service ./services/ai-service
docker run --rm -p 5001:5001 foodconnect-ai-service
```

The service listens on port 5001.

## Routes

| Method | Route | Response |
| --- | --- | --- |
| `GET` | `/health` | JSON service health status |
| `GET` | `/api/forecast` | JSON sample forecast for provider `p-001` |
