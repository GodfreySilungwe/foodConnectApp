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
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { SHARD_COUNT, withUserKeys } = require('./schema');

const enabled = process.env.USE_DYNAMODB === 'true';
const tableName = process.env.USERS_TABLE || 'foodconnect-dev-users-v2';
const autoCreate = process.env.DYNAMODB_AUTO_CREATE_TABLES === 'true';
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
let tableReady;

function tableDefinition() {
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'gsi1pk', AttributeType: 'S' },
      { AttributeName: 'gsi1sk', AttributeType: 'S' },
      { AttributeName: 'gsi2pk', AttributeType: 'S' },
      { AttributeName: 'gsi2sk', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'DistrictRoleIndex',
        KeySchema: [
          { AttributeName: 'gsi1pk', KeyType: 'HASH' },
          { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GlobalUsersIndex',
        KeySchema: [
          { AttributeName: 'gsi2pk', KeyType: 'HASH' },
          { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  };
}

async function ensureTable() {
  if (!enabled) return;
  if (!tableReady) {
    tableReady = (async () => {
      try {
        await client.send(new DescribeTableCommand({ TableName: tableName }));
      } catch (error) {
        if (error.name !== 'ResourceNotFoundException' || !autoCreate) {
          throw error;
        }
        try {
          await client.send(new CreateTableCommand(tableDefinition()));
        } catch (createError) {
          if (createError.name !== 'ResourceInUseException') throw createError;
        }
        await waitUntilTableExists({ client: rawClient, maxWaitTime: 60 }, { TableName: tableName });
      }
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

async function queryPartition(partitionName, partitionValue, indexName, sortName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await client.send(new QueryCommand({
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: '#partition = :partition',
      ExpressionAttributeNames: {
        '#partition': partitionName,
      },
      ExpressionAttributeValues: { ':partition': partitionValue },
      ExclusiveStartKey,
      ...(sortName ? { ScanIndexForward: true } : {}),
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function getUser(userId) {
  if (!enabled) return null;
  await ensureTable();
  const result = await client.send(new GetCommand({
    TableName: tableName,
    Key: { id: userId },
    ConsistentRead: true,
  }));
  return result.Item || null;
}

async function findUserByEmail(email) {
  if (!enabled) return null;
  await ensureTable();
  const normalizedEmail = String(email).trim().toLowerCase();
  const lock = await client.send(new GetCommand({
    TableName: tableName,
    Key: { id: `EMAIL#${normalizedEmail}` },
    ConsistentRead: true,
  }));
  return lock.Item ? getUser(lock.Item.userId) : null;
}

async function listUsers() {
  if (!enabled) return null;
  await ensureTable();
  const users = await Promise.all(Array.from({ length: SHARD_COUNT }, (_, shard) =>
    queryPartition('gsi2pk', `USERS#SHARD#${shard}`, 'GlobalUsersIndex', 'gsi2sk')
  ));
  return users.flat().sort((left, right) => left.gsi2sk.localeCompare(right.gsi2sk));
}

async function listUsersByDistrictRole(district, role) {
  if (!enabled) return null;
  await ensureTable();
  const users = await Promise.all(Array.from({ length: SHARD_COUNT }, (_, shard) =>
    queryPartition('gsi1pk', `DISTRICT#${district}#ROLE#${role}#SHARD#${shard}`, 'DistrictRoleIndex', 'gsi1sk')
  ));
  return users.flat().sort((left, right) => left.gsi1sk.localeCompare(right.gsi1sk));
}

async function saveUser(user) {
  if (!enabled) return;
  await ensureTable();
  const normalizedEmail = String(user.email).trim().toLowerCase();
  const storedUser = withUserKeys({
    ...user,
    email: normalizedEmail,
  });
  const existingUser = await getUser(user.id);
  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      const lockId = `EMAIL#${normalizedEmail}`;
      const lockResult = await client.send(new GetCommand({
        TableName: tableName,
        Key: { id: lockId },
        ConsistentRead: true,
      }));
      if (lockResult.Item?.userId === user.id) {
        await client.send(new PutCommand({ TableName: tableName, Item: storedUser }));
        return;
      }
      if (lockResult.Item && lockResult.Item.userId !== user.id) {
        const duplicateError = new Error('User already exists');
        duplicateError.code = 'EMAIL_EXISTS';
        throw duplicateError;
      }
      await client.send(new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: tableName, Item: storedUser } },
          {
            Put: {
              TableName: tableName,
              Item: { id: lockId, entityType: 'EMAIL', userId: user.id, email: normalizedEmail },
              ConditionExpression: 'attribute_not_exists(id)',
            },
          },
        ],
      }));
      return;
    }
    await client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: tableName, Item: storedUser } },
        {
          Delete: {
            TableName: tableName,
            Key: { id: `EMAIL#${existingUser.email}` },
            ConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': user.id },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: { id: `EMAIL#${normalizedEmail}`, entityType: 'EMAIL', userId: user.id, email: normalizedEmail },
            ConditionExpression: 'attribute_not_exists(id)',
          },
        },
      ],
    }));
    return;
  }

  try {
    await client.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: storedUser,
            ConditionExpression: 'attribute_not_exists(id)',
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: { id: `EMAIL#${normalizedEmail}`, entityType: 'EMAIL', userId: user.id, email: normalizedEmail },
            ConditionExpression: 'attribute_not_exists(id)',
          },
        },
      ],
    }));
  } catch (error) {
    if (error.name === 'TransactionCanceledException' && await findUserByEmail(normalizedEmail)) {
      const duplicateError = new Error('User already exists');
      duplicateError.code = 'EMAIL_EXISTS';
      throw duplicateError;
    }
    throw error;
  }
}

module.exports = { enabled, findUserByEmail, getUser, listUsers, listUsersByDistrictRole, saveUser };