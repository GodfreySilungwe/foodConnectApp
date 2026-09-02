# Identity Service

## Purpose

The Identity Service manages authentication, profile information, and role-based access for customers and providers.

## Responsibilities
- register user
- login user
- fetch profile
- manage role assignment
- support customer and provider identity separation

## Base URL

```text
http://localhost:3002
```

## Health Endpoint

```http
GET /health
```

## Example Response

```json
{
  "status": "ok",
  "service": "identity-service"
}
```

## API Endpoints

### GET /api/users
Returns example user records.

## Notes

This service is a minimal Sprint 1 foundation and will expand in Sprint 2 with real auth logic and Cognito integration.
