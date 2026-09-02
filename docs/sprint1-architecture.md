# Sprint 1 Architecture Blueprint

## Goal

This Sprint establishes the minimum viable cloud foundation for FoodConnect so the team can deploy and validate one backend service on AWS ECS Fargate with authentication, database access, and public HTTP exposure.

## Architecture Overview

```text
Internet
  |
  v
Application Load Balancer
  |
  v
ECS Fargate Service
  |
  +--> FoodConnect Backend API
  |
  +--> CloudWatch Logs
  |
  +--> DynamoDB (users, providers, menus, orders)
  |
  +--> Cognito for identity and auth
```

## Core Components

### 1. Networking
- VPC
- 2 public subnets
- 2 private subnets
- Internet Gateway
- NAT Gateway
- Security Groups
- ALB

### 2. Compute
- ECS Cluster
- Fargate task definition
- One backend service for Sprint 1
- Health endpoint at /health

### 3. Data Layer
- DynamoDB tables for:
  - users
  - providers
  - menus
  - orders

### 4. Identity
- Amazon Cognito User Pool
- App Client for frontend access

### 5. Container Registry
- ECR repository for backend image

### 6. Monitoring
- CloudWatch log groups
- basic alarms for service failures and high resource usage

### 7. Delivery Pipeline
- GitHub Actions
- Docker build
- push to ECR
- ECS deployment update

## Resource Naming Convention

Use a consistent naming pattern:

- project: foodconnect
- environment: dev
- region: e.g. ap-southeast-1
- examples:
  - foodconnect-dev-vpc
  - foodconnect-dev-alb
  - foodconnect-dev-ecs-cluster
  - foodconnect-dev-backend
  - foodconnect-dev-users-table

## Network Design

### VPC
- CIDR: 10.0.0.0/16

### Public Subnets
- 10.0.1.0/24
- 10.0.2.0/24

### Private Subnets
- 10.0.11.0/24
- 10.0.12.0/24

### Security Groups
- ALB SG: inbound 80/443 from 0.0.0.0/0
- ECS SG: inbound from ALB only on app port, e.g. 3001

## ECS Task Design

### Service Type
- Fargate

### Container Port
- 3001

### Health Check
- /health

### Minimum Task Specs
- CPU: 256
- Memory: 512
- Container definitions:
  - backend image from ECR
  - env vars for DB and Cognito config
  - CloudWatch logs enabled

## DynamoDB Design for Sprint 1

### Users Table
- PK: userId

### Providers Table
- PK: providerId

### Menus Table
- PK: providerId
- SK: menuId

### Orders Table
- PK: orderId
- GSI: userId
- GSI: providerId

This structure is intentionally simple and aligned with a capstone MVP.

## Cognito Setup

- User Pool: foodconnect-dev-users
- Sign-in method: email/password
- App client: foodconnect-dev-app
- Allowed callback URLs: frontend URL(s)

## CI/CD Flow

```text
GitHub push
  -> GitHub Actions
  -> Docker build
  -> ECR push
  -> ECS service update
  -> CloudWatch logs
```

## Sprint 1 Deliverables

By the end of Sprint 1, the team should have:
- working AWS foundation,
- deployed backend on ECS Fargate,
- health endpoint accessible through ALB,
- Cognito authentication configured,
- DynamoDB tables provisioned,
- CI/CD pipeline in place,
- basic monitoring and logs active.

## Risks to Avoid

- do not create too many services in Sprint 1
- do not over-engineer networking
- do not use production-scale data patterns yet
- do not attempt advanced AI or payment systems before the core deployment works

## Recommended Next Action

Implement the foundation in this order:
1. VPC and subnets
2. ECR
3. DynamoDB
4. Cognito
5. ECS cluster and task definition
6. ALB and target group
7. CI/CD deployment pipeline
8. verify health endpoint
