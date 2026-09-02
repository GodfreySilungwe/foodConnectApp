# Order Service

## Purpose

The Order Service handles order creation, status tracking, fulfillment updates, and basic delivery workflow state changes.

## Responsibilities
- create order
- get order by id
- update order status
- accept or reject order
- track preparation and delivery lifecycle

## Base URL

```text
http://localhost:3004
```

## Health Endpoint

```http
GET /health
```

## Example Response

```json
{
  "status": "ok",
  "service": "order-service"
}
```

## API Endpoints

### GET /api/orders
Returns example order records.

## Notes

This service is intentionally focused on a clear order-state workflow and supports the Sprint 2 order creation story.
