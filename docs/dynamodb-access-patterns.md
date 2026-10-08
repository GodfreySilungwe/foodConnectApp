# DynamoDB Access Patterns

The v2 tables use on-demand capacity, unique base keys, and deterministic 16-way sharding for user and directory indexes. District is an indexed attribute, not a shared base partition key. This avoids placing every account in a district on one logical partition key.

## Identity

Table: `foodconnect-<environment>-users-v2`

- Base key: `id` (unique user ID); account/session/status operations use `GetItem`.
- Email lock item: `id = EMAIL#<normalized-email>` stores the owning user ID. Login performs a strongly consistent `GetItem` for the lock and then a direct user `GetItem`; registration writes the user and lock atomically, enforcing uniqueness without an eventually consistent GSI.
- `DistrictRoleIndex`: `gsi1pk = DISTRICT#<district>#ROLE#<role>#SHARD#<0..15>`; `gsi1sk = CREATED#<timestamp>#USER#<id>`.
- `GlobalUsersIndex`: `gsi2pk = USERS#SHARD#<0..15>`; `gsi2sk = ROLE#<role>#DISTRICT#<district>#USER#<id>`.

Admin account listing requires both a district and a role, and queries all 16 district/role shards. Legacy records without district are indexed under `UNKNOWN` for manual assignment. Registration only accepts Malawi's 28 named districts.

## Providers, Schools, and Menus

Tables: `providers-v2`, `schools-v2`, and `menus-v2`.

- Base key: `id` (unique record ID); detail/owner operations use `GetItem` or an owner GSI.
- `DistrictIndex`: district + entity type + deterministic shard; `gsi1sk` sorts by normalized name and ID.
- `DirectoryIndex`: entity type + deterministic shard; `gsi2sk` sorts by normalized name and ID.
- Provider `OwnerIndex`: `OWNER#<userId>`.
- Provider `SchoolCoverageIndex`: `SCHOOL#<schoolId>#SHARD#<n>` with provider ID as sort key. Membership records are updated when provider school coverage changes, so school details/counts query only associated providers.
- Menu `ProviderMenuIndex`: `PROVIDER#<providerId>#SHARD#<n>` with menu ID as sort key.
- `NameIndex`: normalized exact name lookup for school duplicate checks.

District-scoped admin and directory routes require a valid district. School/provider account creation persists its own district, which may differ from an account owner's district.

## Orders and Payments

Tables: `orders-v2` and `payments-v2`.

Orders use `pk = ORDER#<orderId>`, `sk = META`; GSI indexes support:

- `KitchenDateIndex`: kitchen + service date + shard, sorted by `serviceAt`.
- `KitchenTimelineIndex`: kitchen + shard, sorted by `serviceAt`.
- `CustomerTimelineIndex`: customer + shard, sorted by `serviceAt`.
- `GlobalTimelineIndex`: global + shard, sorted by `serviceAt` for bounded admin reports.

Payments use `pk = PAYMENT#<paymentId>`, `sk = META`, with kitchen/date shards, a kitchen timeline, and order-ID lookup. The repository exposes payment reads/writes, but this application has no payment processor/settlement writer yet; payment rows must only be written after a verified settlement event.

Order and payment date queries require a date or a bounded `from`/`to` range (maximum 31 days). Per-request table descriptions are cached, and missing tables are auto-created only when `DYNAMODB_AUTO_CREATE_TABLES=true`; production should provision tables with Terraform.

## Migration

Terraform creates new v2 tables with on-demand capacity, deletion protection, point-in-time recovery, and matching indexes. Existing tables are left untouched because DynamoDB primary keys cannot be changed in place.

The migration utility is a one-time operation. It scans v1 tables, derives v2 keys, copies records in batches of 25, retries unprocessed writes, and never deletes source records. Orders without a trustworthy `scheduledFor`, `serviceAt`, or `createdAt` are reported and left in v1 rather than assigned a fabricated date.

1. Review this design and back up/export the source tables.
2. Apply Terraform to provision the v2 tables and wait for all GSIs to become active.
3. Set `LEGACY_*_TABLE` variables if the old table names differ from defaults.
4. Run `node services/order-service/migrate-v2.js` for a dry-run count review. For large production tables, use DynamoDB point-in-time export to S3 and an offline transform instead of an online Scan.
5. Run with `--apply` only after reviewing counts and data treatment. Verify representative user/email, district, provider/school, menu, and order reads.
6. Deploy services configured to use the v2 table names. Keep v1 tables until reconciliation and rollback windows have passed.

The migration utility is the only intended scan path; normal service requests must use `GetItem` or indexed `Query` operations.
