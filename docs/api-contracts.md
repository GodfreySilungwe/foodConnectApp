# Service API Contracts

This document defines the contract structure for the Sprint 2 and subsequent sprint implementation. The design follows a lightweight, practical approach suitable for an individual or small team capstone.

## Identity Service

### Base URL
`http://localhost:3002`

### Endpoints

#### POST /api/auth/register
Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "customer"
}
```

Response:
```json
{
  "userId": "u-001",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "customer"
}
```

#### POST /api/auth/login
Request body:
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

Response:
```json
{
  "token": "jwt-token",
  "user": {
    "userId": "u-001",
    "role": "customer"
  }
}
```

#### GET /api/users/:userId
Response:
```json
{
  "userId": "u-001",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "customer"
}
```

---

## Provider Service

### Base URL
`http://localhost:3003`

### Endpoints

#### POST /api/providers
Request body:
```json
{
  "name": "Sunrise Kitchen",
  "ownerName": "Alice",
  "email": "sunrise@example.com",
  "status": "active"
}
```

Response:
```json
{
  "providerId": "p-001",
  "name": "Sunrise Kitchen",
  "status": "active"
}
```

#### GET /api/providers/:providerId
Response:
```json
{
  "providerId": "p-001",
  "name": "Sunrise Kitchen",
  "status": "active",
  "menuCount": 7
}
```

#### POST /api/providers/:providerId/menu
Request body:
```json
{
  "menuId": "m-101",
  "name": "Chicken Rice",
  "price": 22.5,
  "available": true
}
```

Response:
```json
{
  "menuId": "m-101",
  "providerId": "p-001",
  "name": "Chicken Rice",
  "price": 22.5,
  "available": true
}
```

---

## Order Service

### Base URL
`http://localhost:3004`

### Endpoints

#### POST /api/orders
Request body:
```json
{
  "customerId": "u-001",
  "providerId": "p-001",
  "items": [
    {
      "menuId": "m-101",
      "quantity": 2
    }
  ],
  "scheduledFor": "2026-09-10T13:00:00Z",
  "deliveryType": "delivery"
}
```

Response:
```json
{
  "orderId": "o-1001",
  "status": "pending",
  "total": 45.0
}
```

#### GET /api/orders/:orderId
Response:
```json
{
  "orderId": "o-1001",
  "customerId": "u-001",
  "providerId": "p-001",
  "status": "pending",
  "deliveryType": "delivery",
  "total": 45.0
}
```

#### PATCH /api/orders/:orderId/status
Request body:
```json
{
  "status": "accepted"
}
```

Response:
```json
{
  "orderId": "o-1001",
  "status": "accepted"
}
```

---

## AI Service

### Base URL
`http://localhost:5001`

### Endpoints

#### GET /api/forecast
Response:
```json
{
  "providerId": "p-001",
  "forecast": [
    {
      "item": "Chicken Rice",
      "predictedDemand": 84
    },
    {
      "item": "Beef Burger",
      "predictedDemand": 48
    }
  ]
}
```

#### GET /api/insights/report
Response:
```json
{
  "providerId": "p-001",
  "report": {
    "topItems": ["Chicken Rice", "Beef Burger"],
    "demandSummary": "Demand is trending upward for chicken-based meals",
    "recommendation": "Increase preparation quantity for Chicken Rice by 15%"
  }
}
```

---

## Shared Response Pattern

Use a consistent response contract:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

Error responses should follow:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": []
}
```

## Notes

- Keep payloads simple for Sprint 2.
- Validate request bodies before processing.
- Use consistent naming for providerId, orderId, and menuId.
- This structure provides a practical contract for the capstone without overengineering.
