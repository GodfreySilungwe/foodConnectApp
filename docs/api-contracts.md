# Implemented API Routes

This document lists routes registered by the current services. For exact request validation and response fields, see the route handlers and automated tests.

Local base URLs are configured in `docker-compose.yml`:

| Service | Base URL |
| --- | --- |
| Backend API | `http://localhost:3001` |
| Identity | `http://localhost:3002` |
| Provider and school | `http://localhost:3003` |
| Order | `http://localhost:3004` |

The backend API and each Node.js domain service expose `GET /health`. The backend also exposes `GET /api`.

## Identity service

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Public; supported self-registration roles are customer, provider, and school. |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/auth/session` | Authenticated user |
| `GET` | `/api/users` | Admin |
| `GET` | `/api/admin/users` | Admin or super-admin |
| `GET` | `/api/admin/users/:userId` | Admin or super-admin |
| `PATCH` | `/api/admin/users/:userId/status` | Super-admin |

## Provider and school service

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/api/providers` | Public |
| `GET` | `/api/providers/:providerId` | Public |
| `GET` | `/api/providers/:providerId/image` | Public |
| `GET` | `/api/providers/:providerId/menu` | Public |
| `GET` | `/api/menu/featured` | Public |
| `GET` | `/api/menu/:menuId/images/:imageIndex` | Public |
| `GET` | `/api/schools` | Public |
| `GET` | `/api/schools/:schoolId` | Public |
| `GET` | `/api/schools/:schoolId/image` | Public |
| `GET` | `/api/schools/:schoolId/providers` | Public |
| `POST` | `/api/providers` | Provider |
| `PUT` | `/api/providers/:providerId/profile` | Provider; owning provider |
| `PUT` | `/api/providers/:providerId/schools` | Provider; owning provider |
| `POST` | `/api/providers/:providerId/menu` | Provider; owning provider |
| `PUT` | `/api/providers/:providerId/menu/:menuId` | Provider; owning provider |
| `PUT` | `/api/providers/:providerId/menu/:menuId/availability` | Provider; owning provider |
| `GET` | `/api/my/menu` | Provider |
| `POST` | `/api/providers/:providerId/ratings` | Customer |
| `POST` | `/api/schools` | Authenticated school, provider, admin, or super-admin |
| `PUT` | `/api/schools/:schoolId` | Authenticated school, provider, admin, or super-admin; non-admin users must own the school record |
| `GET` | `/api/admin/providers` | Admin or super-admin |
| `GET` | `/api/admin/schools` | Super-admin |
| `PATCH` | `/api/admin/providers/:providerId/status` | Super-admin |
| `PATCH` | `/api/admin/schools/:schoolId/status` | Super-admin |

Directory routes accept filters implemented by the handlers, including district and coordinates where supported.

## Order service

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/orders` | Customer |
| `GET` | `/api/orders` | Authenticated customer, provider, or administrator; results are scoped by role and authenticated identity |
| `PATCH` | `/api/orders/:orderId/status` | Provider; authorized for the owning provider |
| `GET` | `/api/payments` | Provider |
| `GET` | `/api/orders/:orderId/payments` | Provider |

Order and payment list filters support the date/range and pagination parameters handled by the service. The service validates date ranges and limits their maximum width. Customer and provider order results are scoped using authenticated account claims, not caller-supplied owner IDs.

## AI example service

The Flask service in `services/ai-service` exposes:

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/health` | Public |
| `GET` | `/api/forecast` | Public |

`GET /api/forecast` returns a fixed sample forecast for provider `p-001`.
