# Terraform Sprint 1 Infrastructure

This folder contains a simple Terraform foundation for the Sprint 1 AWS deployment.

## Prerequisites

- Terraform v1.5+
- AWS CLI installed and configured
- AWS access credentials configured in the local environment

## Initialize Terraform

```bash
terraform init
```

## Validate configuration

```bash
terraform validate
```

## Plan the infrastructure

```bash
terraform plan
```

## Apply the infrastructure

```bash
terraform apply
```

## Destroy the infrastructure

```bash
terraform destroy
```

## Notes

- This infrastructure is intentionally minimal and appropriate for Sprint 1.
- It creates VPC, subnets, ALB, ECS cluster, security groups, DynamoDB tables, and ECR repository.
- It does not define ECS task definitions or ECS services; those must be configured separately.
- Additional services such as Cognito and advanced networking can be added in later sprints.

## ECS application container configuration

The three DynamoDB-backed services should use the ECS task role for AWS credentials. Set
`USE_DYNAMODB=true`, `AWS_REGION=ap-southeast-1`, and
`DYNAMODB_AUTO_CREATE_TABLES=false` on each service. Do not set
`DYNAMODB_ENDPOINT`, `AWS_ACCESS_KEY_ID`, or `AWS_SECRET_ACCESS_KEY` in ECS.
Grant each service's task role least-privilege access to its tables and indexes.

| ECS service | Required table variables |
| --- | --- |
| Identity | `USERS_TABLE=foodconnect-dev-users-v2` |
| Provider | `PROVIDERS_TABLE=foodconnect-dev-providers-v2`, `MENUS_TABLE=foodconnect-dev-menus-v2`, `SCHOOLS_TABLE=foodconnect-dev-schools-v2` |
| Order | `ORDERS_TABLE=foodconnect-dev-orders-v2`, `PAYMENTS_TABLE=foodconnect-dev-payments-v2` |

Set `JWT_SECRET` from Secrets Manager (or another ECS-supported secret source), not
as a committed value. Set `FRONTEND_ORIGIN` to the deployed web app's HTTPS origin.
The provider and order services also need `IDENTITY_SERVICE_URL` set to an address
they can reach inside the VPC, such as an ECS Service Connect name or private load
balancer URL.

The frontend's `NEXT_PUBLIC_*` API URLs are embedded in the JavaScript bundle at
image build time. Supply the deployed public API URLs as Docker build arguments
(`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_IDENTITY_API_URL`,
`NEXT_PUBLIC_PROVIDER_API_URL`, and `NEXT_PUBLIC_ORDER_API_URL`) when building the
production image; changing those values only in the ECS task definition is too late.
The local Compose configuration intentionally builds with localhost URLs.

Do not deploy the `dynamodb-local` Compose service to ECS. Use the managed DynamoDB
tables in the same AWS Region as the ECS tasks.
