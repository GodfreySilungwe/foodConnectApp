const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const enabled = process.env.USE_DYNAMODB === 'true';
const tableName = process.env.ORDERS_TABLE || 'foodconnect-dev-orders';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: process.env.DYNAMODB_ENDPOINT || undefined, region: process.env.AWS_REGION || 'ap-southeast-1', credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeMyKeyId', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeSecretAccessKey' }, maxAttempts: 1 }));

async function ensureTable() {
  if (!enabled) return;
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') throw error;
    await client.send(new CreateTableCommand({ TableName: tableName, KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }], AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }], BillingMode: 'PAY_PER_REQUEST' }));
  }
}

async function listOrders() {
  if (!enabled) return null;
  await ensureTable();
  const result = await client.send(new ScanCommand({ TableName: tableName }));
  return result.Items || [];
}

async function saveOrder(order) {
  if (enabled) {
    await ensureTable();
    await client.send(new PutCommand({ TableName: tableName, Item: order }));
  }
}

module.exports = { enabled, listOrders, saveOrder };
