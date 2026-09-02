# Sprint 1 AWS Checklist

## 1. Account Setup
- [ ] Create AWS account
- [ ] Enable MFA
- [ ] Create IAM developer user
- [ ] Set billing alerts
- [ ] Verify permissions for ECS, ECR, VPC, IAM, CloudWatch, Cognito, DynamoDB, and Secrets Manager

## 2. Networking
- [ ] Create VPC
- [ ] Create public subnets
- [ ] Create private subnets
- [ ] Create Internet Gateway
- [ ] Create NAT Gateway if needed
- [ ] Configure route tables
- [ ] Create security groups

## 3. Container Registry
- [ ] Create ECR repo for backend
- [ ] Optional: create separate repo for frontend if needed
- [ ] Ensure images can be pushed after Docker build

## 4. Database
- [ ] Create DynamoDB tables: users, providers, menus, orders
- [ ] Define simple PK schema
- [ ] Document access patterns for each table

## 5. Authentication
- [ ] Create Cognito User Pool
- [ ] Create App Client
- [ ] Enable email/password sign-in
- [ ] Capture user pool ID and client ID
- [ ] Configure callback URLs

## 6. Fargate Deployment
- [ ] Create ECS cluster
- [ ] Create execution role
- [ ] Create task definition
- [ ] Configure container port mapping
- [ ] Create ECS service
- [ ] Add health check endpoint

## 7. Load Balancer
- [ ] Create ALB
- [ ] Configure target group
- [ ] Add listener on port 80 or 443
- [ ] Ensure service health checks pass

## 8. Monitoring and Security
- [ ] Create CloudWatch log groups
- [ ] Enable log retention
- [ ] Create basic alarms
- [ ] Store secrets in Secrets Manager
- [ ] Avoid hardcoded credentials

## 9. CI/CD
- [ ] Create GitHub repo
- [ ] Add GitHub Actions workflow
- [ ] Configure AWS credentials
- [ ] Build Docker image
- [ ] Push image to ECR
- [ ] Deploy image to ECS

## 10. Sprint 1 Completion Check
- [ ] App runs locally
- [ ] App can be containerized
- [ ] Images are pushed to ECR
- [ ] Backend is deployed on ECS Fargate
- [ ] Health endpoint works
- [ ] Authentication works with Cognito
- [ ] Database connectivity works
- [ ] Monitoring logs are visible in CloudWatch

## Notes
- Keep Sprint 1 minimal and stable
- Do not add extra services before the foundation works
- Focus on a working deployment, not full production complexity
