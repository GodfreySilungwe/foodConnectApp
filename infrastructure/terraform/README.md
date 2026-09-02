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
- Additional services such as Cognito and advanced networking can be added in later sprints.
