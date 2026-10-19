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
Returns provider records. Embedded profile and school images in list responses are replaced with image endpoint URLs so discovery payloads stay small. Menu image URLs are returned in the same way.

### Image endpoints

```http
GET /api/providers/:providerId/image
GET /api/schools/:schoolId/image
GET /api/menu/:menuId/images/:imageIndex
```

These endpoints serve stored embedded images on demand. List JSON responses larger than 1 KB are gzip-compressed when the client advertises `Accept-Encoding: gzip`. Detail and provider-edit responses retain their full image data.

## Notes

This service is intentionally narrow for Sprint 1 and should expand with proper validation and persistence in Sprint 2.
