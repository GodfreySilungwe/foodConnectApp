# Docker Desktop Setup for FoodConnect

## Goal

This document explains how to run the Sprint 1 application locally with Docker Desktop before deploying to AWS ECS Fargate.

## Requirements

- Docker Desktop installed and running
- Windows 10/11 with WSL 2 enabled if required by Docker Desktop
- Git installed

## Step 1: Start Docker Desktop

1. Open Docker Desktop.
2. Wait until the Docker engine is fully running.
3. Verify:

```bash
docker --version
docker compose version
```

## Step 2: Create the environment file

At the project root, create a `.env` file based on `.env.example`.

Example:

```env
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
AWS_REGION=ap-southeast-1
```

## Step 3: Build and run the app

From the project root:

```bash
docker compose up --build
```

This will start:
- backend on port 3001
- frontend on port 3000

## Step 4: Verify the app is running

Check backend health:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"status":"ok","service":"foodconnect-backend"}
```

Open the frontend in a browser:

```text
http://localhost:3000
```

## Step 5: Stop the app

```bash
docker compose down
```

## Step 6: Rebuild after code changes

```bash
docker compose up --build
```

## Notes

- Docker Compose is used for local development and validation.
- AWS ECS/Fargate will be used for cloud deployment in the later sprint.
- Keep container definitions simple for Sprint 1.

## Useful Docker Compose Commands

```bash
docker compose ps
docker compose logs -f
docker compose down -v
```
