# AI Service

## Purpose

The AI Service provides forecast and recommendation support for food providers based on historical order data.

## Responsibilities
- analyze historical order data
- predict demand
- generate recommendations
- produce provider summary insight report

## Base URL

```text
http://localhost:5001
```

## Health Endpoint

```http
GET /health
```

## Example Response

```json
{
  "status": "ok",
  "service": "ai-service"
}
```

## API Endpoints

### GET /api/forecast
Returns sample forecast data for menu items.

## Notes

The AI module uses a lightweight, explainable analytics approach and is intentionally limited to practical demand forecasting for the capstone.
