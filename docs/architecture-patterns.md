# Implemented Architecture Patterns

This document summarizes patterns used by the FoodConnect application. See [Architecture Decisions and Patterns](architecture-decisions-and-patterns.md) for the detailed rationale and source-file evidence; the [design and testing report](capstone-design-and-testing.md) records the test results.

## Domain-separated services

Identity, provider/school, and order functionality are implemented in separate Express applications. The Next.js frontend calls the service responsible for each operation.

## HTTP APIs and testable application modules

The services expose HTTP routes with JSON payloads. The Express application modules are imported into Jest/Supertest suites to test route behavior without starting a separate network process.

## Data-access modules and DynamoDB keys

Persistence logic is grouped in data-access/repository modules. DynamoDB records use direct keys and secondary indexes for implemented lookups. The order schema helper constructs sharded service-date keys for order and payment records. See [DynamoDB access patterns](dynamodb-access-patterns.md) for the keys and indexes.

## Token-based authentication and role checks

The identity service issues JWTs. Protected service routes validate the token and check the authenticated user's role and ownership before allowing the operation.

## Local Docker Compose environment

The root Compose file defines the frontend, backend API, identity, provider, and order containers and DynamoDB Local. It also defines local ports, environment settings, service dependencies, and health checks.

## Coordinate-based distance ordering

The provider service implements a Haversine distance calculation and uses coordinates to order provider and school directory results.

## AWS container deployment and infrastructure as code

The application services run as containerized ECS tasks using AWS Fargate compute. Docker images are stored in Amazon ECR, and an Application Load Balancer routes HTTP traffic through target groups with health checks. Terraform defines the VPC/networking, ALB, ECR, ECS cluster and roles, CloudWatch log group, and DynamoDB table infrastructure present in the repository. The production domain services have separate ECS task definitions and services beyond this backend-focused Terraform baseline.
