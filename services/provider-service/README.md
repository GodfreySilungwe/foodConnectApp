# Provider Service

## Purpose

The Provider Service manages provider registration, business profile data, menus, and provider availability.

## Responsibilities
- register provider
- update provider details
- create and update menu items
- set item availability
- expose provider catalog data

## Base URL

```text
http://localhost:3003
```

## Health Endpoint

```http
GET /health
```

## Example Response

```json
{
  "status": "ok",
  "service": "provider-service"
}
```

## API Endpoints

### GET /api/providers
Returns example provider records.

## Notes

This service is intentionally narrow for Sprint 1 and should expand with proper validation and persistence in Sprint 2.
