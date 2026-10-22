# FoodConnect: Design and Testing

This document describes the FoodConnect application in this repository and records the automated test results run on 21 October 2026.

## Application

FoodConnect is a Malawi-focused school meal discovery and ordering web application. Parents can browse schools, providers, and menus and place orders. Providers manage profiles, menus, school coverage, and incoming orders. School and administrator accounts support school listings and account or listing administration.

The implemented product is a web application.

## Architecture

```text
Browser
  -> Next.js frontend (port 3000)
      -> Identity service (port 3002)
      -> Provider and school service (port 3003)
      -> Order service (port 3004)
      -> Backend API (port 3001)
          -> /health and /api

Identity, provider, and order services
  -> DynamoDB in configured AWS environment
  -> DynamoDB Local in the root Docker Compose environment
```

| Component | Implemented responsibility |
| --- | --- |
| Frontend | Next.js 14 and React 18 pages for authentication, schools, providers, menus, profiles, and orders. |
| Identity service | Express routes for registration, login, authenticated session retrieval, user listings, and super-admin account status updates. |
| Provider and school service | Express routes for provider and school directories, profiles, school coverage, menus, images, ratings, and administrator listing/status operations. |
| Order service | Express routes for customer order creation, authenticated order listing, provider status updates, and payment-ledger queries. |
| Backend API | Express health route at `/health` and API information route at `/api`. |
| Data access | DynamoDB repositories and key/index helpers; the Compose configuration connects the domain services to DynamoDB Local. |
| AI example service | Flask health route and `/api/forecast`, which returns fixed example forecast values. |

The root `docker-compose.yml` starts the frontend, backend, identity, provider, and order containers with DynamoDB Local. The exact service routes are listed in [Implemented API Routes](api-contracts.md).

## Architecture patterns

The implemented patterns and their rationale are described in [Architecture Decisions and Patterns](architecture-decisions-and-patterns.md). DynamoDB partition/sort keys and GSIs are detailed in [DynamoDB Access Patterns](dynamodb-access-patterns.md).

The deployed application URL in the [README](../README.md) returned HTTP 200 when checked on 21 October 2026. The checked-in Terraform is a backend-focused AWS infrastructure baseline; the frontend and domain services also use their own ECS task definitions, services, and target groups. The checked-in GitHub Actions workflow builds and deploys the backend image only.

## Agile task board

I use a [GitHub Projects board](https://github.com/users/GodfreySilungwe/projects/1) to document FoodConnect tasks and delivered features. The board is linked from the [README](../README.md); its visibility must allow the grader to view it without needing access to my GitHub account.

## Automated tests

The following repository test suites passed on 21 October 2026:

| Service | Test file | Passed |
| --- | --- | ---: |
| Identity | `services/identity-service/tests/auth.test.js` | 14 |
| Provider | `services/provider-service/tests/provider.test.js` | 27 |
| Order | `services/order-service/tests/order.test.js` | 17 |
| Backend API | `backend/tests/health.test.js` | 1 |
| **Total** | **4 suites** | **59** |

The test cases exercise registration and login, role restrictions, district validation, provider and school operations, menu validation, distance ordering, order creation and access, status changes, date-range validation, and the backend health route.

Run the suites from the repository root:

```text
npm --prefix services/identity-service test
npm --prefix services/provider-service test
npm --prefix services/order-service test
npm --prefix backend test
```

## Deployment evidence

The deployed application URL in the [README](../README.md) returned HTTP 200 when checked on 21 October 2026. This check verifies an HTTP response from the frontend URL.

The repository contains Terraform resources for AWS networking, an application load balancer, ECS, ECR, CloudWatch, and DynamoDB. The Terraform region default is `us-east-1`. The checked-in GitHub Actions workflow builds and deploys the `backend/` application and sets `ap-southeast-1`; it is separate from the deployed frontend and domain-service setup.

## Local run

Start the Compose application from the repository root:

```text
docker compose up --build
```

Open `http://localhost:3000`. The backend and domain-service health routes are available on ports 3001–3004 at `/health`. Stop the containers with:

```text
docker compose down
```

The [Local Docker Setup](docker-desktop-setup.md) document lists the local endpoints and commands.
