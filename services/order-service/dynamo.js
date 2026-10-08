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

const enabled = process.env.USE_DYNAMODB === 'true';
const autoCreate = process.env.DYNAMODB_AUTO_CREATE_TABLES === 'true';
const ordersTable = process.env.ORDERS_TABLE || 'foodconnect-dev-orders-v2';
const paymentsTable = process.env.PAYMENTS_TABLE || 'foodconnect-dev-payments-v2';
const rawClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeMyKeyId',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeSecretAccessKey',
  },
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

async function queryAll({ tableName, indexName, partitionName, partitionValue, sortName, from, to }) {
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

  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await client.send(new QueryCommand({
      TableName: tableName,
      ...(indexName ? { IndexName: indexName } : {}),
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ExclusiveStartKey,
      ScanIndexForward: true,
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function queryShards(query, partitionForShard, timestampField = 'serviceAt') {
  const results = await Promise.all(Array.from({ length: SHARD_COUNT }, (_, shard) => query({
    ...partitionForShard(shard),
  })));
  return results.flat().sort((left, right) => left[timestampField].localeCompare(right[timestampField]));
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

async function listOrdersByKitchenDate(providerId, day, from, to) {
  if (!enabled) return null;
  await ensureOrdersTable();
  return queryShards((partition) => queryAll({
    tableName: ordersTable,
    indexName: 'KitchenDateIndex',
    partitionName: 'gsi1pk',
    sortName: 'gsi1sk',
    from: from ? `SERVICE_AT#${from}` : null,
    to: to ? `SERVICE_AT#${to}` : null,
    ...partition,
  }), (shard) => ({ partitionValue: `KITCHEN#${providerId}#DAY#${day}#SHARD#${shard}` }));
}

async function listOrdersByProvider(providerId, from, to) {
  if (!enabled) return null;
  await ensureOrdersTable();
  return queryShards((partition) => queryAll({
    tableName: ordersTable,
    indexName: 'KitchenTimelineIndex',
    partitionName: 'gsi2pk',
    sortName: 'gsi2sk',
    from: from ? `SERVICE_AT#${from}` : null,
    to: to ? `SERVICE_AT#${to}` : null,
    ...partition,
  }), (shard) => ({ partitionValue: `KITCHEN#${providerId}#SHARD#${shard}` }));
}

async function listOrdersByCustomer(customerId, from, to) {
  if (!enabled) return null;
  await ensureOrdersTable();
  return queryShards((partition) => queryAll({
    tableName: ordersTable,
    indexName: 'CustomerTimelineIndex',
    partitionName: 'gsi3pk',
    sortName: 'gsi3sk',
    from: from ? `SERVICE_AT#${from}` : null,
    to: to ? `SERVICE_AT#${to}` : null,
    ...partition,
  }), (shard) => ({ partitionValue: `CUSTOMER#${customerId}#SHARD#${shard}` }));
}

async function listOrders(from, to) {
  if (!enabled) return null;
  await ensureOrdersTable();
  return queryShards((partition) => queryAll({
    tableName: ordersTable,
    indexName: 'GlobalTimelineIndex',
    partitionName: 'gsi4pk',
    sortName: 'gsi4sk',
    from: from ? `SERVICE_AT#${from}` : null,
    to: to ? `SERVICE_AT#${to}` : null,
    ...partition,
  }), (shard) => ({ partitionValue: `ORDERS#SHARD#${shard}` }));
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

async function listPaymentsByProvider(providerId, from, to) {
  if (!enabled) return null;
  await ensurePaymentsTable();
  return queryShards((partition) => queryAll({
    tableName: paymentsTable,
    indexName: 'KitchenTimelineIndex',
    partitionName: 'gsi2pk',
    sortName: 'gsi2sk',
    from: from ? `SETTLED_AT#${from}` : null,
    to: to ? `SETTLED_AT#${to}` : null,
    ...partition,
  }), (shard) => ({ partitionValue: `KITCHEN#${providerId}#SHARD#${shard}` }), 'settledAt');
}

async function listPaymentsByKitchenDate(providerId, day, from, to) {
  if (!enabled) return null;
  await ensurePaymentsTable();
  const results = await Promise.all(Array.from({ length: SHARD_COUNT }, (_, shard) => queryAll({
    tableName: paymentsTable,
    indexName: 'KitchenDateIndex',
    partitionName: 'gsi1pk',
    sortName: 'gsi1sk',
    partitionValue: `KITCHEN#${providerId}#DAY#${day}#SHARD#${shard}`,
    from: from ? `SETTLED_AT#${from}` : null,
    to: to ? `SETTLED_AT#${to}` : null,
  })));
  return results.flat().sort((left, right) => left.settledAt.localeCompare(right.settledAt));
}

async function listPaymentsByOrder(orderId) {
  if (!enabled) return null;
  await ensurePaymentsTable();
  return queryAll({
    tableName: paymentsTable,
    indexName: 'OrderPaymentsIndex',
    partitionName: 'gsi3pk',
    partitionValue: `ORDER#${orderId}`,
    sortName: 'gsi3sk',
  });
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