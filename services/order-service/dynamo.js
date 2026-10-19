const {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { SHARD_COUNT } = require('./schema');
const { decodeCursor, encodeCursor } = require('./pagination');

const enabled = process.env.USE_DYNAMODB === 'true';
const autoCreate = process.env.DYNAMODB_AUTO_CREATE_TABLES === 'true';
const ordersTable = process.env.ORDERS_TABLE || 'foodconnect-dev-orders-v2';
const paymentsTable = process.env.PAYMENTS_TABLE || 'foodconnect-dev-payments-v2';
const rawClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
  maxAttempts: 3,
});
const client = DynamoDBDocumentClient.from(rawClient);
const readyTables = new Map();

const orderIndexes = [
  { name: 'KitchenDateIndex', pk: 'gsi1pk', sk: 'gsi1sk' },
  { name: 'KitchenTimelineIndex', pk: 'gsi2pk', sk: 'gsi2sk' },
  { name: 'CustomerTimelineIndex', pk: 'gsi3pk', sk: 'gsi3sk' },
  { name: 'GlobalTimelineIndex', pk: 'gsi4pk', sk: 'gsi4sk' },
];

const paymentIndexes = [
  { name: 'KitchenDateIndex', pk: 'gsi1pk', sk: 'gsi1sk' },
  { name: 'KitchenTimelineIndex', pk: 'gsi2pk', sk: 'gsi2sk' },
  { name: 'OrderPaymentsIndex', pk: 'gsi3pk', sk: 'gsi3sk' },
];

function tableDefinition(tableName, indexes) {
  const indexedAttributes = new Set(['pk', 'sk']);
  for (const index of indexes) {
    indexedAttributes.add(index.pk);
    indexedAttributes.add(index.sk);
  }

  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [...indexedAttributes].map((AttributeName) => ({ AttributeName, AttributeType: 'S' })),
    GlobalSecondaryIndexes: indexes.map((index) => ({
      IndexName: index.name,
      KeySchema: [
        { AttributeName: index.pk, KeyType: 'HASH' },
        { AttributeName: index.sk, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    })),
  };
}

async function ensureTable(tableName, indexes) {
  if (!enabled) return;
  if (!readyTables.has(tableName)) {
    const ready = (async () => {
      try {
        await client.send(new DescribeTableCommand({ TableName: tableName }));
      } catch (error) {
        if (error.name !== 'ResourceNotFoundException' || !autoCreate) throw error;
        try {
          await client.send(new CreateTableCommand(tableDefinition(tableName, indexes)));
        } catch (createError) {
          if (createError.name !== 'ResourceInUseException') throw createError;
        }
        await waitUntilTableExists({ client: rawClient, maxWaitTime: 60 }, { TableName: tableName });
      }
    })().catch((error) => {
      readyTables.delete(tableName);
      throw error;
    });
    readyTables.set(tableName, ready);
  }
  await readyTables.get(tableName);
}

async function queryPage({ tableName, indexName, partitionName, partitionValue, sortName, from, to, cursorKey, limit }) {
  const names = { '#partition': partitionName };
  const values = { ':partition': partitionValue };
  let keyCondition = '#partition = :partition';
  if (sortName && from && to) {
    names['#sort'] = sortName;
    values[':from'] = from;
    values[':to'] = `${to}~`;
    keyCondition += ' AND #sort BETWEEN :from AND :to';
  } else if (sortName && from) {
    names['#sort'] = sortName;
    values[':from'] = from;
    keyCondition += ' AND #sort >= :from';
  } else if (sortName && to) {
    names['#sort'] = sortName;
    values[':to'] = `${to}~`;
    keyCondition += ' AND #sort <= :to';
  }

  const result = await client.send(new QueryCommand({
    TableName: tableName,
    ...(indexName ? { IndexName: indexName } : {}),
    KeyConditionExpression: keyCondition,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
    Limit: limit,
    ScanIndexForward: true,
  }));
  return { items: result.Items || [], lastEvaluatedKey: result.LastEvaluatedKey || null };
}

function orderCursorKey(item, index) {
  return { pk: item.pk, sk: item.sk, [index.pk]: item[index.pk], [index.sk]: item[index.sk] };
}

function paymentCursorKey(item, index) {
  return { pk: item.pk, sk: item.sk, [index.pk]: item[index.pk], [index.sk]: item[index.sk] };
}

async function queryShardsPage({ query, partitionForShard, scope, cursor, limit, index, timestampField = 'serviceAt', keyForItem }) {
  const state = decodeCursor(cursor, scope, SHARD_COUNT);
  const results = await Promise.all(Array.from({ length: SHARD_COUNT }, async (_, shard) => {
    if (state.done[shard]) return { shard, items: [], lastEvaluatedKey: null };
    const result = await query({ ...partitionForShard(shard), cursorKey: state.positions[shard], limit });
    return { ...result, shard };
  }));
  const ordered = results.flatMap(({ shard, items }) => items.map((item) => ({ shard, item })))
    .sort((left, right) => left.item[timestampField].localeCompare(right.item[timestampField]) || left.item.id.localeCompare(right.item.id));
  const selected = ordered.slice(0, limit);
  const positions = [...state.positions];
  const done = [...state.done];

  for (const result of results) {
    const selectedFromShard = selected.filter((entry) => entry.shard === result.shard);
    const unconsumed = selectedFromShard.length < result.items.length;
    if (selectedFromShard.length) positions[result.shard] = keyForItem(selectedFromShard[selectedFromShard.length - 1].item, index);
    if (!result.lastEvaluatedKey && !unconsumed) done[result.shard] = true;
    else done[result.shard] = false;
  }

  const hasMore = done.some((shardDone) => !shardDone);
  return {
    items: selected.map(({ item }) => item),
    hasMore,
    nextCursor: hasMore ? encodeCursor(scope, { positions, done }) : null,
  };
}

async function ensureOrdersTable() {
  await ensureTable(ordersTable, orderIndexes);
}

async function ensurePaymentsTable() {
  await ensureTable(paymentsTable, paymentIndexes);
}

async function saveOrder(order) {
  if (!enabled) return;
  await ensureOrdersTable();
  await client.send(new PutCommand({ TableName: ordersTable, Item: order }));
}

async function findOrder(orderId) {
  if (!enabled) return null;
  await ensureOrdersTable();
  const result = await client.send(new GetCommand({
    TableName: ordersTable,
    Key: { pk: `ORDER#${orderId}`, sk: 'META' },
    ConsistentRead: true,
  }));
  return result.Item || null;
}

async function listOrdersByKitchenDate(providerId, day, from, to, { cursor, limit }) {
  if (!enabled) return null;
  await ensureOrdersTable();
  const index = orderIndexes[0];
  const scope = JSON.stringify(['orders-kitchen-date', providerId, day, from, to, limit]);
  return queryShardsPage({
    query: (partition) => queryPage({ tableName: ordersTable, indexName: index.name, partitionName: index.pk, sortName: index.sk, from: from ? `SERVICE_AT#${from}` : null, to: to ? `SERVICE_AT#${to}` : null, ...partition }),
    partitionForShard: (shard) => ({ partitionValue: `KITCHEN#${providerId}#DAY#${day}#SHARD#${shard}` }),
    scope, cursor, limit, index, keyForItem: orderCursorKey,
  });
}

async function listOrdersByProvider(providerId, from, to, { cursor, limit }) {
  if (!enabled) return null;
  await ensureOrdersTable();
  const index = orderIndexes[1];
  const scope = JSON.stringify(['orders-kitchen', providerId, from, to, limit]);
  return queryShardsPage({
    query: (partition) => queryPage({ tableName: ordersTable, indexName: index.name, partitionName: index.pk, sortName: index.sk, from: from ? `SERVICE_AT#${from}` : null, to: to ? `SERVICE_AT#${to}` : null, ...partition }),
    partitionForShard: (shard) => ({ partitionValue: `KITCHEN#${providerId}#SHARD#${shard}` }),
    scope, cursor, limit, index, keyForItem: orderCursorKey,
  });
}

async function listOrdersByCustomer(customerId, from, to, { cursor, limit }) {
  if (!enabled) return null;
  await ensureOrdersTable();
  const index = orderIndexes[2];
  const scope = JSON.stringify(['orders-customer', customerId, from, to, limit]);
  return queryShardsPage({
    query: (partition) => queryPage({ tableName: ordersTable, indexName: index.name, partitionName: index.pk, sortName: index.sk, from: from ? `SERVICE_AT#${from}` : null, to: to ? `SERVICE_AT#${to}` : null, ...partition }),
    partitionForShard: (shard) => ({ partitionValue: `CUSTOMER#${customerId}#SHARD#${shard}` }),
    scope, cursor, limit, index, keyForItem: orderCursorKey,
  });
}

async function listOrders(from, to, { cursor, limit }) {
  if (!enabled) return null;
  await ensureOrdersTable();
  const index = orderIndexes[3];
  const scope = JSON.stringify(['orders-global', from, to, limit]);
  return queryShardsPage({
    query: (partition) => queryPage({ tableName: ordersTable, indexName: index.name, partitionName: index.pk, sortName: index.sk, from: from ? `SERVICE_AT#${from}` : null, to: to ? `SERVICE_AT#${to}` : null, ...partition }),
    partitionForShard: (shard) => ({ partitionValue: `ORDERS#SHARD#${shard}` }),
    scope, cursor, limit, index, keyForItem: orderCursorKey,
  });
}

async function updateOrderStatus(orderId, status) {
  if (!enabled) return null;
  await ensureOrdersTable();
  const result = await client.send(new UpdateCommand({
    TableName: ordersTable,
    Key: { pk: `ORDER#${orderId}`, sk: 'META' },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ConditionExpression: 'attribute_exists(pk)',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes || null;
}

async function savePayment(payment) {
  if (!enabled) return;
  await ensurePaymentsTable();
  await client.send(new PutCommand({ TableName: paymentsTable, Item: payment }));
}

async function listPaymentsByProvider(providerId, from, to, { cursor, limit }) {
  if (!enabled) return null;
  await ensurePaymentsTable();
  const index = paymentIndexes[1];
  const scope = JSON.stringify(['payments-kitchen', providerId, from, to, limit]);
  return queryShardsPage({
    query: (partition) => queryPage({ tableName: paymentsTable, indexName: index.name, partitionName: index.pk, sortName: index.sk, from: from ? `SETTLED_AT#${from}` : null, to: to ? `SETTLED_AT#${to}` : null, ...partition }),
    partitionForShard: (shard) => ({ partitionValue: `KITCHEN#${providerId}#SHARD#${shard}` }),
    scope, cursor, limit, index, keyForItem: paymentCursorKey, timestampField: 'settledAt',
  });
}

async function listPaymentsByKitchenDate(providerId, day, from, to, { cursor, limit }) {
  if (!enabled) return null;
  await ensurePaymentsTable();
  const index = paymentIndexes[0];
  const scope = JSON.stringify(['payments-kitchen-date', providerId, day, from, to, limit]);
  return queryShardsPage({
    query: (partition) => queryPage({ tableName: paymentsTable, indexName: index.name, partitionName: index.pk, sortName: index.sk, from: from ? `SETTLED_AT#${from}` : null, to: to ? `SETTLED_AT#${to}` : null, ...partition }),
    partitionForShard: (shard) => ({ partitionValue: `KITCHEN#${providerId}#DAY#${day}#SHARD#${shard}` }),
    scope, cursor, limit, index, keyForItem: paymentCursorKey, timestampField: 'settledAt',
  });
}

async function listPaymentsByOrder(orderId, { cursor, limit }) {
  if (!enabled) return null;
  await ensurePaymentsTable();
  const index = paymentIndexes[2];
  const scope = JSON.stringify(['payments-order', orderId, limit]);
  const state = decodeCursor(cursor, scope, 1);
  const result = await queryPage({
    tableName: paymentsTable,
    indexName: index.name,
    partitionName: index.pk,
    partitionValue: `ORDER#${orderId}`,
    sortName: index.sk,
    cursorKey: state.positions[0],
    limit,
  });
  const done = !result.lastEvaluatedKey;
  return {
    items: result.items,
    hasMore: !done,
    nextCursor: done ? null : encodeCursor(scope, { positions: [result.lastEvaluatedKey], done: [false] }),
  };
}

module.exports = {
  enabled,
  findOrder,
  listOrders,
  listOrdersByCustomer,
  listOrdersByKitchenDate,
  listOrdersByProvider,
  listPaymentsByKitchenDate,
  listPaymentsByOrder,
  listPaymentsByProvider,
  saveOrder,
  savePayment,
  updateOrderStatus,
};