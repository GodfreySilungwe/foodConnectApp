# Sprint 2 Backlog

## Goal

Build the first real business functionality: authentication, provider registration, menu creation, and order creation.

## User Stories

### 1. User Registration and Login
- As a customer, I want to sign up so that I can order food.
- As a provider, I want to sign up so that I can manage my menu.
- As a user, I want to log in so that I can access my account.

### 2. Provider Registration
- As a provider, I want to register my business profile.
- As a provider, I want to manage profile details.

### 3. Menu Creation
- As a provider, I want to add menu items and prices.
- As a provider, I want to toggle item availability.

### 4. Order Creation
- As a customer, I want to place an order for a menu item.
- As a customer, I want to schedule a pickup or delivery.
- As a provider, I want to receive and manage orders.

## Sprint 2 Deliverables

- working identity registration and login endpoints
- provider profile creation endpoint
- menu creation endpoint
- order creation endpoint
- basic validation and error handling
- unit tests for core business rules

## Acceptance Criteria

- a customer can register successfully
- a provider can register successfully
- a provider can create a menu item
- a customer can create an order
- the order has a status and total value
- the API responds with clear success/failure payloads

## Suggested Technical Approach

- use Express service pattern consistently
- keep each service responsible for one domain
- create validation helpers for request bodies
- write TDD tests before implementing each API
- use simple in-memory or mocked persistence in Sprint 2, then move to DynamoDB later

## Example Sprint 2 Tasks

1. Create auth validation rules
2. Implement registration endpoint in identity service
3. Implement provider creation endpoint in provider service
4. Implement menu item creation endpoint in provider service
5. Implement order creation endpoint in order service
6. Add integration tests for each endpoint
7. Document Swagger or Postman-friendly API examples
