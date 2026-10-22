# FoodConnect

Dear Grader,

I built FoodConnect as a Malawi-focused school meal discovery and ordering application. Parents can explore schools, food providers, and menus, then place and follow orders. Providers can manage their listings and incoming orders, while school and administrator accounts support the school directory.

This repository contains the project code and documentation. The application uses a Next.js frontend, Node.js/Express services, and DynamoDB. My [design and testing report](docs/capstone-design-and-testing.md) describes the implemented architecture, design patterns, and test results.

## Project links

| Deliverable | Link or status |
| --- | --- |
| Source repository | [GodfreySilungwe/foodConnectApp](https://github.com/GodfreySilungwe/foodConnectApp) |
| Deployed application | [Open FoodConnect](http://foodconnectalb-634192677.us-east-1.elb.amazonaws.com:3000/) — I verified that it returned HTTP 200 on 21 October 2026. |
| Design and testing document | [Read my design and testing report](docs/capstone-design-and-testing.md) |
| Agile task board | [View my FoodConnect GitHub Projects board](https://github.com/users/GodfreySilungwe/projects/1) |

## What I implemented

- Role-based experiences for parents/customers, providers, schools, and administrators.
- School and provider directories, menu browsing, and provider-to-school coverage.
- Location-aware discovery and approximate distance estimates when coordinates are available.
- Parent ordering, provider order management, order status updates, and date-based order history.
- Service health endpoints and a local Docker Compose setup using DynamoDB Local.

I also included a Flask service with a health endpoint and a forecast endpoint that returns fixed example values. The root Docker Compose stack starts the main web application and domain services.

## How the application is organized

```text
Browser
  -> Next.js frontend (port 3000)
      -> Backend API (port 3001)
      -> Identity service (port 3002)
      -> Provider service (port 3003)
      -> Order service (port 3004)
          -> DynamoDB (AWS) or DynamoDB Local (development)
```

The root Compose configuration starts the frontend, backend, identity, provider, and order containers, together with DynamoDB Local. The backend provides health and API information routes; identity, provider, and order handle separate areas of the application.

## Cloud and infrastructure skills I used

- **AWS ECS and Fargate:** I containerized and ran the application services as ECS tasks using Fargate compute.
- **Amazon ECR:** I built and published container images used by ECS task definitions to private ECR repositories. The Terraform-managed backend repository enables image scanning on push.
- **Application Load Balancer (ALB):** I routed HTTP traffic through listeners and target groups and used `/health` target-group checks to monitor target availability.
- **Terraform:** I described AWS infrastructure as code, including VPC and subnet resources, an internet gateway and public routes, security groups, an ALB, ECR, an ECS cluster, IAM roles, a CloudWatch log group, and DynamoDB tables.
- **Amazon DynamoDB (NoSQL):** I designed table partition keys, sort keys, and Global Secondary Indexes (GSIs) for user, directory, menu, school-coverage, and order queries. I used deterministic sharding for distributed directory and order queries.
- **AWS IAM and CloudWatch:** I configured ECS execution/task roles and CloudWatch log retention for the backend log group.

The Terraform configuration in this repository describes the backend deployment foundation and DynamoDB tables; the deployed frontend and domain services use their own ECS task definitions, services, and target groups. The checked-in GitHub Actions workflow builds and deploys only the backend service. More detail on the infrastructure and DynamoDB design is in my [design and testing report](docs/capstone-design-and-testing.md) and [DynamoDB access patterns](docs/dynamodb-access-patterns.md).

## Run the project locally

Prerequisites: Docker Desktop with Docker Compose and Git.

From the repository root, start the application:

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000). The APIs use local ports 3001–3004, and DynamoDB Local uses port 8000. Compose uses placeholder credentials for local development only; do not use them in a deployed environment.

To check service health:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

When you are finished, stop the containers:

```bash
docker compose down
```

For more detail, see my [local Docker setup guide](docs/docker-desktop-setup.md) and [.env.example](.env.example). To run a component without Compose, install its dependencies in its package directory and use its `dev` script.

## Tests I ran

I ran the existing automated test suites with these commands:

```bash
npm --prefix services/identity-service test
npm --prefix services/provider-service test
npm --prefix services/order-service test
npm --prefix backend test
```

All 59 tests in those suites passed in my documented run. The [design and testing report](docs/capstone-design-and-testing.md) lists the suites and their coverage.

## Project documentation

- [Design and testing report](docs/capstone-design-and-testing.md) — architecture, implemented design patterns, and test results.
- [Architecture decisions and patterns](docs/architecture-decisions-and-patterns.md) — layered services, repositories, DynamoDB design, frontend structure, and cloud deployment patterns.
- [Implemented API routes](docs/api-contracts.md) — routes registered by the current services.
- [DynamoDB access patterns](docs/dynamodb-access-patterns.md) — table keys, indexes, and query patterns used by the services.
- [Architecture patterns](docs/architecture-patterns.md) — patterns used in the application.
- [Local Docker setup](docs/docker-desktop-setup.md) — instructions for running the application locally.
