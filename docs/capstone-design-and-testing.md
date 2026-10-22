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

### Deployment option and cost considerations

The current deployment uses AWS-managed services: ECS on Fargate, an Application Load Balancer, ECR, DynamoDB, and CloudWatch. This reduces the need to manage operating systems and container hosts and supports scaling individual services. The trade-off is that costs are usage- and configuration-dependent: Fargate bills for allocated CPU and memory while tasks run; the ALB has ongoing hourly and capacity-related charges; DynamoDB charges depend on its capacity mode, requests, and storage; and ECR storage, CloudWatch logs, and network transfer can add costs.

For a small capstone workload, a lower-cost option could be a single small virtual machine running containers, but that shifts patching, host availability, scaling, and operations to the project owner. On-premises hosting may make sense where suitable infrastructure already exists, but requires that infrastructure to be operated and exposed securely. The managed AWS design is the selected option for this project; actual cost should be estimated for the target region and traffic, and controlled by sizing tasks appropriately, monitoring usage, and removing unused resources. No measured monthly cost is claimed here.

## Agile task board

I use a [GitHub Projects Kanban board](https://github.com/users/GodfreySilungwe/projects/1) to track tasks and delivered features. Completed work is linked to repository issues and supporting commits.

| Sprint | Focus | Milestone |
| --- | --- | --- |
| Sprint 1 | Repository pattern, registration, and role-based access | [Sprint 1 milestone](https://github.com/GodfreySilungwe/foodConnectApp/milestone/1) |
| Sprint 2 | UI/mobile experience, DynamoDB indexes, and location-aware discovery | [Sprint 2 milestone](https://github.com/GodfreySilungwe/foodConnectApp/milestone/2) |
| Sprint 3 | Order persistence/workflows and AWS/ALB deployment | [Sprint 3 milestone](https://github.com/GodfreySilungwe/foodConnectApp/milestone/3) |
| Sprint 4 | Time/hash GSI design and even/odd write sharding | [Sprint 4 milestone](https://github.com/GodfreySilungwe/foodConnectApp/milestone/4) |

The board is also linked from the [README](../README.md).

### User-story and success-criteria coverage

I added the supplied user stories to the board and used the issue status to distinguish delivered work from gaps. The closed issues represent features present in the current implementation; open issues remain in the backlog where the feature is incomplete or not implemented.

| User story / success criterion | Board issue | Current status and evidence |
| --- | --- | --- |
| Customer registration and provider discovery | [#5](https://github.com/GodfreySilungwe/foodConnectApp/issues/5), [#10](https://github.com/GodfreySilungwe/foodConnectApp/issues/10) | Delivered. Registration and role access are tracked in #5; provider browsing and discovery are tracked in #10. |
| Place an order for a date and time; choose collection or delivery | [#11](https://github.com/GodfreySilungwe/foodConnectApp/issues/11) | Delivered. Order creation persists scheduled order details and fulfilment choice. |
| Track order status and ensure the lifecycle updates correctly | [#12](https://github.com/GodfreySilungwe/foodConnectApp/issues/12) | Delivered. The order service enforces lifecycle transitions and the frontend displays order statuses. |
| Provider manages menu items and prices | [#13](https://github.com/GodfreySilungwe/foodConnectApp/issues/13) | Delivered. Provider menu management and price handling are implemented. |
| Provider receives and accepts/rejects customer orders | [#14](https://github.com/GodfreySilungwe/foodConnectApp/issues/14) | Delivered. Provider-authorized actions and allowed order transitions are implemented in the order service. |
| Provider views historical demand trends and simple AI-based recommendations | [#15](https://github.com/GodfreySilungwe/foodConnectApp/issues/15) | Partial; remains open. The provider page shows basic order metrics and top dishes, while the forecast endpoint returns fixed example data rather than personalized, data-driven recommendations. |
| Driver sees assigned orders and updates delivery status | [#16](https://github.com/GodfreySilungwe/foodConnectApp/issues/16) | Not implemented; remains open. The current application has no driver role, assigned-order view, or driver delivery-status workflow. |

The board provides the detailed tasks and acceptance criteria.

## Recorded presentation

The [recorded FoodConnect presentation](https://drive.google.com/file/d/1nNwAUdFNJUrDBMV-InfCAyxKBUzA_sXj/view?usp=sharing) is hosted on Google Drive.

## Automated tests

The following repository test suites passed on 21 October 2026:

| Service | Test file | Passed |
| --- | --- | ---: |
| Identity | `services/identity-service/tests/auth.test.js` | 14 |
| Provider | `services/provider-service/tests/provider.test.js` | 27 |
| Order | `services/order-service/tests/order.test.js` | 17 |
| Backend API | `backend/tests/health.test.js` | 1 |
| **Total** | **4 suites** | **59** |

The test cases exercise registration and login, role restrictions, district validation, provider and school operations, menu validation, distance ordering, order creation and access, status changes, date-range validation, and the backend health route. Jest and Supertest exercise Express endpoints with HTTP-level requests, making route behavior, validation, and authorization repeatable without starting a production server. The suites use the project's test configuration and in-memory repositories where applicable, which keeps them isolated from AWS and makes them fast to rerun.

These results document the automated suites listed above; they do not by themselves establish browser-based end-to-end coverage or production DynamoDB integration coverage. I should record any manual/browser tests separately, including the user journey, test data, expected result, observed result, and date, rather than imply they were covered by these automated tests.

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
