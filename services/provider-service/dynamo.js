const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const enabled = process.env.USE_DYNAMODB === 'true';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: process.env.DYNAMODB_ENDPOINT || undefined, region: process.env.AWS_REGION || 'ap-southeast-1', credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeMyKeyId', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeSecretAccessKey' }, maxAttempts: 1 }));

async function ensureTable(tableName) {
  if (!enabled) return;
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') throw error;
    const key = tableName.endsWith('menus') ? 'id' : 'id';
    await client.send(new CreateTableCommand({ TableName: tableName, KeySchema: [{ AttributeName: key, KeyType: 'HASH' }], AttributeDefinitions: [{ AttributeName: key, AttributeType: 'S' }], BillingMode: 'PAY_PER_REQUEST' }));
  }
}

async function listItems(tableName) {
  if (!enabled) return null;
  await ensureTable(tableName);
  const result = await client.send(new ScanCommand({ TableName: tableName }));
  return result.Items || [];
}

async function saveItem(tableName, item) {
  if (!enabled) return;
  await ensureTable(tableName);
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
}

module.exports = { enabled, listItems, saveItem };
