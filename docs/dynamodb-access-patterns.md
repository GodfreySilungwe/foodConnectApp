# DynamoDB Access Patterns

The domain services use DynamoDB repositories for user, provider, school, menu, order, and payment records. The root Docker Compose configuration points the services at DynamoDB Local and enables automatic table creation for local development.

## Key design

The services use multiple purpose-specific NoSQL tables, not a single-table design. Each table's base partition key supports a direct record lookup; secondary-index partition and sort keys support the service's directory and timeline queries. Tables use on-demand (`PAY_PER_REQUEST`) capacity. AWS bills for requests and storage, including secondary-index storage and requests.

Partition and sort key values are selected for the implemented access patterns: entity ID for direct user/provider/school/menu reads, email lock for account lookup, and composite entity/date/owner values for filtered listings. GSIs project all item attributes (`ProjectionType: ALL`) in the service table definitions. The code derives 16 deterministic shards using the SHA-256 hash of a record ID. The shard is included in applicable GSI partition keys to spread directory and timeline records across partitions. A listing that spans all shards queries each shard and combines the results; sharding therefore distributes writes but adds read fan-out.

## Identity records

The v2 users table uses `id` as its base partition key. Email-lock records use `EMAIL#<normalized-email>` as an ID. Registration writes the user and email-lock records transactionally; login resolves the normalized email through its lock record and then loads the user. The following GSIs support user directory queries:

- `DistrictRoleIndex`: `gsi1pk = DISTRICT#<district>#ROLE#<role>#SHARD#<0..15>` and `gsi1sk = CREATED#<timestamp>#USER#<id>`.
- `GlobalUsersIndex`: `gsi2pk = USERS#SHARD#<0..15>` and `gsi2sk = ROLE#<role>#DISTRICT#<district>#USER#<id>`.

## Providers, schools, and menus

The v2 provider, school, and menu tables use `id` as their base partition key. Their GSIs support the implemented directory and relationship lookups:

- Provider and school `DistrictIndex`: `gsi1pk` combines district, entity type, and shard; `gsi1sk` sorts records by normalized name and ID.
- Provider and school `DirectoryIndex`: `gsi2pk` is the entity type and shard; `gsi2sk` sorts by normalized name and ID.
- Provider `OwnerIndex`: `gsi3pk = OWNER#<userId>` and `gsi3sk = PROVIDER#<providerId>`.
- Provider `SchoolCoverageIndex`: `gsi4pk = SCHOOL#<schoolId>#SHARD#<n>` and `gsi4sk = PROVIDER#<providerId>`. Provider coverage changes maintain separate relationship records.
- Menu `ProviderMenuIndex`: `gsi1pk = PROVIDER#<providerId>#SHARD#<n>` and `gsi1sk` identifies the menu item.
- School `NameIndex`: `gsi5pk = NAME#<normalized-name>` and `gsi5sk` contains district and school ID.

## Orders

The v2 orders table uses `pk = ORDER#<orderId>` as its partition key and `sk = META` as its sort key. A deterministic SHA-256-derived shard is included in each GSI partition key:

- `KitchenDateIndex`: `gsi1pk` combines provider, service date, and shard; `gsi1sk` sorts by service timestamp and order ID.
- `KitchenTimelineIndex`: `gsi2pk` combines provider and shard; `gsi2sk` sorts by service timestamp and order ID.
- `CustomerTimelineIndex`: `gsi3pk` combines customer and shard; `gsi3sk` sorts by service timestamp and order ID.
- `GlobalTimelineIndex`: `gsi4pk` combines the global order group and shard; `gsi4sk` sorts by service timestamp and order ID.

Order and provider payment list routes support date-based or bounded date-range filters. The order service validates date ranges, including a maximum 31-day window.

## Payments

The v2 payments table uses `pk = PAYMENT#<paymentId>` as its partition key and `sk = META` as its sort key. `KitchenDateIndex` and `KitchenTimelineIndex` support provider/date and provider timeline queries; `OrderPaymentsIndex` supports lookup by order ID. The order service exposes authenticated provider routes to query payment records.

## Table provisioning and protection

Terraform in `infrastructure/terraform/main.tf` defines the DynamoDB tables, indexes, on-demand billing, deletion protection, and point-in-time recovery settings for v2 tables. The services create missing tables only when `DYNAMODB_AUTO_CREATE_TABLES=true`; the root Docker Compose file enables this setting for local development.
