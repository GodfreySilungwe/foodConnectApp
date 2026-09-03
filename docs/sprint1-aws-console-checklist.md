# Sprint 1 AWS Console Checklist

This document gives the exact AWS console steps to configure the Sprint 1 foundation for FoodConnect without guessing.

## 1. Create IAM User and Enable MFA

### Actions
1. Open AWS IAM Console.
2. Choose Users > Add users.
3. Create a username such as `foodconnect-dev-admin`.
4. Select AWS access type:
   - Programmatic access
   - optionally AWS Management Console access if needed
5. Attach the following policies for early setup:
   - AdministratorAccess for the initial development phase, or a more restricted custom policy if preferred
6. Create the user.
7. Save access key ID and secret access key.
8. Enable MFA on the user.

### Notes
- For a capstone, using an admin user for development is acceptable at the beginning.
- Keep access keys in a secure place.

---

## 2. Configure Billing Alarm

### Actions
1. Open CloudWatch Console.
2. Go to Billing alarms.
3. Create an alarm for estimated spend.
4. Set threshold such as $10 or $20 USD.
5. Add email notifications.

### Goal
- Prevent surprise AWS costs during capstone development.

---

## 3. Create VPC and Subnets

### Actions
1. Open VPC Console.
2. Choose Create VPC.
3. Select VPC only.
4. Set CIDR block: `10.0.0.0/16`.
5. Create the following subnets:
   - Public subnet A: `10.0.1.0/24`
   - Public subnet B: `10.0.2.0/24`
   - Private subnet A: `10.0.11.0/24`
   - Private subnet B: `10.0.12.0/24`
6. Ensure the public subnets have `Map public IP on launch` enabled.
7. Create an Internet Gateway and attach it to the VPC.
8. Create a route table for public subnets and add route `0.0.0.0/0 -> Internet Gateway`.
9. Associate public subnets with the public route table.
10. Optionally add a NAT Gateway for private subnet internet access if later needed.

### Goal
- Provide network separation for ALB and ECS tasks.

---

## 4. Create Security Groups

### Security Group: ALB
1. Open EC2 > Security Groups.
2. Create a security group named `foodconnect-dev-alb-sg`.
3. Attach it to the VPC.
4. Inbound rules:
   - HTTP 80 from `0.0.0.0/0`
   - HTTPS 443 from `0.0.0.0/0`
5. Outbound rule: allow all.

### Security Group: ECS Tasks
1. Create a security group named `foodconnect-dev-ecs-sg`.
2. Attach it to the same VPC.
3. Inbound rule:
   - TCP port `3001` from the ALB security group
4. Outbound rule: allow all.

### Goal
- Restrict traffic so only the ALB can reach the application container.

---

## 5. Create ECR Repository

### Actions
1. Open ECR Console.
2. Choose Create repository.
3. Name it `foodconnect-dev-backend`.
4. Keep it private.
5. Enable image scanning if available.
6. Save the repository URI.

### Goal
- Store backend Docker images for ECS deployment.

---

## 6. Create DynamoDB Tables

### Tables to create
- `foodconnect-dev-users`
- `foodconnect-dev-providers`
- `foodconnect-dev-menus`
- `foodconnect-dev-orders`

### For each table
1. Open DynamoDB Console.
2. Choose Create table.
3. Set partition key.
4. For simple Sprint 1 setup use:
   - users: `userId`
   - providers: `providerId`
   - menus: `menuId` or `providerId + menuId`
   - orders: `orderId`
5. Do not overcomplicate the schema in Sprint 1.

### Goal
- Keep data storage simple and access-pattern driven.

---

## 7. Create Cognito User Pool

### Actions
1. Open Cognito Console.
2. Choose User pools > Create user pool.
3. Name it `foodconnect-dev-users`.
4. Choose email sign-in.
5. Configure password policy with normal security settings.
6. Add app client.
7. Name the app client `foodconnect-dev-app`.
8. Note the User Pool ID and App Client ID.
9. Create domain if needed.
10. Add callback URLs for your frontend app.

### Goal
- Handle customer and provider authentication without writing custom auth logic in Sprint 1.

---

## 8. Create ECS Cluster

### Actions
1. Open ECS Console.
2. Choose Clusters > Create cluster.
3. Select Fargate.
4. Name it `foodconnect-dev-cluster`.
5. Create the cluster.

### Goal
- Prepare the environment for your backend service.

---

## 9. Create IAM Roles for ECS

### Task Execution Role
1. Open IAM Console.
2. Create role for ECS task execution.
3. Trusted entity: `ecs-tasks.amazonaws.com`.
4. Attach `AmazonECSTaskExecutionRolePolicy`.
5. Name it `foodconnect-dev-ecs-execution-role`.

### Task Role
1. Create role for container permissions.
2. Trusted entity: `ecs-tasks.amazonaws.com`.
3. Attach minimal permissions for logs and DynamoDB if required.
4. Name it `foodconnect-dev-ecs-task-role`.

### Goal
- Allow ECS services to pull images and write logs securely.

---

## 10. Create CloudWatch Log Group

### Actions
1. Open CloudWatch Console.
2. Go to Logs > Log groups.
3. Create group: `/ecs/foodconnect-dev-backend`.
4. Set retention to 30 days.

### Goal
- Capture backend logs for debugging and capstone demonstration.

---

## 11. Create ALB and Target Group

### Create Target Group
1. Open EC2 > Target Groups.
2. Choose Create target group.
3. Type: IP addresses.
4. Name: `foodconnect-dev-tg`.
5. Protocol: HTTP.
6. Port: `3001`.
7. VPC: your VPC.
8. Health check path: `/health`.
9. Create target group.

### Create ALB
1. Open EC2 > Load Balancers.
2. Create Application Load Balancer.
3. Name: `foodconnect-dev-alb`.
4. Internet-facing.
5. Select the public subnets.
6. Attach the ALB security group.
7. Configure listener:
   - HTTP 80 -> forward to target group
8. Finish creation.

### Goal
- Expose the backend over a public endpoint for testing and deployment.

---

## 12. Create ECS Task Definition and Service

### Task Definition
1. Open ECS Console.
2. Choose Task definitions > Create new task definition.
3. Launch type: Fargate.
4. Name: `foodconnect-dev-backend`.
5. CPU: `256`.
6. Memory: `512`.
7. Network mode: `awsvpc`.
8. Add container:
   - image: ECR repository URI
   - port mappings: `3001`
   - environment variables:
     - `PORT=3001`
     - `NODE_ENV=development`
   - log configuration: CloudWatch log group `/ecs/foodconnect-dev-backend`
9. Add role: task execution role and task role.
10. Register task definition.

### ECS Service
1. Go to your cluster.
2. Choose Create.
3. Launch type: Fargate.
4. Task definition: `foodconnect-dev-backend`.
5. Service name: `foodconnect-dev-backend-service`.
6. Number of tasks: `1`.
7. Subnets: private subnets.
8. Security group: ECS security group.
9. Assign public IP: disabled.
10. Load balancer: attach ALB and target group.
11. Create service.

### Goal
- Deploy the backend app to AWS ECS.

---

## 13. Create ECR Image and Push

### Local steps
From the backend folder:

```bash
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.ap-southeast-1.amazonaws.com

docker build -t foodconnect-dev-backend .
docker tag foodconnect-dev-backend:latest <aws-account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/foodconnect-dev-backend:latest
docker push <aws-account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/foodconnect-dev-backend:latest
```

### Goal
- Upload the backend image so ECS can run it.

---

## 14. Test the Backend Health Endpoint

### Actions
1. Copy the ALB DNS name.
2. Open in browser or use curl:

```bash
curl http://<alb-dns-name>/health
```

Expected result:

```json
{"status":"ok","service":"foodconnect-backend"}
```

### Goal
- Confirm public deployment and ALB routing work.

---

## 15. Set Up GitHub Actions for CI/CD

### GitHub secrets
Add these in GitHub repository settings > Secrets and variables > Actions:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Actions workflow
- Use the file in [.github/workflows/deploy-sprint1.yml](.github/workflows/deploy-sprint1.yml)
- It will:
  - build the Docker image,
  - push to ECR,
  - update the ECS service.

### Goal
- Automate deployment so Sprint 1 is repeatable and maintainable.

---

## 16. Sprint 1 Completion Checklist

Mark each item complete before moving to Sprint 2:

- [ ] AWS account configured and MFA enabled
- [ ] Billing alert created
- [ ] VPC and subnets created
- [ ] Security groups created
- [ ] ECR repository created
- [ ] DynamoDB tables created
- [ ] Cognito user pool created
- [ ] ECS cluster created
- [ ] IAM roles created
- [ ] CloudWatch logs configured
- [ ] ALB and target group created
- [ ] ECS task definition registered
- [ ] ECS service deployed successfully
- [ ] Backend health check works
- [ ] CI/CD pipeline configured
- [ ] Local project repo pushed to GitHub

---

## Recommended Next Step

After completing these steps, proceed to Sprint 2 with a clean foundation:
- customer registration and login flow,
- provider management,
- menu creation,
- order creation,
- order status updates.

The Sprint 1 setup is complete only when the backend is deployed on AWS ECS Fargate and visible through the ALB health endpoint.

---

## 17. Run the Full Stack Locally with Docker Desktop

From the repository root, make sure Docker Desktop is running and execute:

```bash
docker compose up --build
```

Open the frontend at `http://localhost:3000`. The local ports are:

| Component | Port | Health endpoint |
| --- | ---: | --- |
| Backend foundation | 3001 | `/health` |
| Identity service | 3002 | `/health` |
| Provider service | 3003 | `/health` |
| Order service | 3004 | `/health` |
| Frontend | 3000 | `/` |

To stop the stack:

```bash
docker compose down
```

The frontend uses `NEXT_PUBLIC_IDENTITY_API_URL`, `NEXT_PUBLIC_PROVIDER_API_URL`, and `NEXT_PUBLIC_ORDER_API_URL`. For AWS, set these values to the public API Gateway or ALB URLs and set `FRONTEND_ORIGIN` to the deployed frontend origin.

## 17.1 Use DynamoDB Local for Persistent Development Data

Compose uses the Docker Hub image `amazon/dynamodb-local:latest` and stores its database files in the named volume `dynamodb-data`. The feature services are configured with `USE_DYNAMODB=true` and create these tables automatically on first access:

- `foodconnect-dev-users`
- `foodconnect-dev-providers`
- `foodconnect-dev-menus`
- `foodconnect-dev-orders`

Start the database and services with:

```bash
docker compose up --build -d
```

The local DynamoDB endpoint is `http://localhost:8000`. Data remains after `docker compose down` and is removed only when the volume is explicitly deleted:

```bash
docker compose down -v
```

For AWS deployment, remove `DYNAMODB_ENDPOINT`, set `USE_DYNAMODB=true`, and use an IAM task role instead of local access keys. The table names can remain the same when the AWS region/account is configured.

## 18. Create ECR Repositories for Sprint 2 Services

Create private repositories using these names:

- `foodconnect-dev-identity`
- `foodconnect-dev-provider`
- `foodconnect-dev-order`
- `foodconnect-dev-frontend`

Create one ECS task definition and ECS service per container. Each service should use its matching container port (`3002`, `3003`, `3004`, or `3000`) and expose `/health` as its target group health check. Keep the frontend public behind the ALB and keep the feature services private behind an API gateway or internal routing layer in the next deployment iteration.
