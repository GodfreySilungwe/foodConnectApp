const { createHash } = require('node:crypto');
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
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const SHARD_COUNT = 16;
const enabled = process.env.USE_DYNAMODB === 'true';
const autoCreate = process.env.DYNAMODB_AUTO_CREATE_TABLES === 'true';
const rawClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'ap-southeast-1',
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

function shardForId(id) {
  return createHash('sha256').update(String(id)).digest().readUInt32BE(0) % SHARD_COUNT;
}

function isMenuTable(tableName) {
  return tableName.includes('menus');
}

function isProviderTable(tableName) {
  return tableName.includes('providers');
}

function indexesForTable(tableName) {
  const indexes = [
    { name: isMenuTable(tableName) ? 'ProviderMenuIndex' : 'DistrictIndex', pk: 'gsi1pk', sk: 'gsi1sk' },
    { name: 'DirectoryIndex', pk: 'gsi2pk', sk: 'gsi2sk' },
  ];
  if (!isMenuTable(tableName)) indexes.push({ name: 'OwnerIndex', pk: 'gsi3pk', sk: 'gsi3sk' });
  if (isProviderTable(tableName)) indexes.push({ name: 'SchoolCoverageIndex', pk: 'gsi4pk', sk: 'gsi4sk' });
  if (!isMenuTable(tableName)) indexes.push({ name: 'NameIndex', pk: 'gsi5pk', sk: 'gsi5sk' });
  return indexes;
}

function tableDefinition(tableName) {
  const indexes = indexesForTable(tableName);
  const attributes = new Set(['id']);
  indexes.forEach(({ pk, sk }) => { attributes.add(pk); attributes.add(sk); });
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [...attributes].map((AttributeName) => ({ AttributeName, AttributeType: 'S' })),
    GlobalSecondaryIndexes: indexes.map(({ name, pk, sk }) => ({
      IndexName: name,
      KeySchema: [
        { AttributeName: pk, KeyType: 'HASH' },
        { AttributeName: sk, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    })),
  };
}

async function ensureTable(tableName) {
  if (!enabled) return;
  if (!readyTables.has(tableName)) {
    const ready = (async () => {
      try {
        await client.send(new DescribeTableCommand({ TableName: tableName }));
      } catch (error) {
        if (error.name !== 'ResourceNotFoundException' || !autoCreate) throw error;
        try {
          await client.send(new CreateTableCommand(tableDefinition(tableName)));
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

function withIndexKeys(tableName, item) {
  const shard = shardForId(item.id);
  if (item.entityType === 'SCHOOL_PROVIDER') {
    return {
      ...item,
      gsi4pk: `SCHOOL#${item.schoolId}#SHARD#${shard}`,
      gsi4sk: `PROVIDER#${item.providerId}`,
    };
  }
  const normalizedName = String(item.name || item.id).trim().toLowerCase();
  const directoryType = isMenuTable(tableName) ? 'MENUS' : isProviderTable(tableName) ? 'PROVIDERS' : 'SCHOOLS';
  return {
    ...item,
    gsi1pk: isMenuTable(tableName)
      ? `PROVIDER#${item.providerId}#SHARD#${shard}`
      : `DISTRICT#${item.district || 'UNKNOWN'}#ROLE#${directoryType}#SHARD#${shard}`,
    gsi1sk: isMenuTable(tableName) ? `MENU#${item.id}` : `NAME#${normalizedName}#ID#${item.id}`,
    gsi2pk: `${directoryType}#SHARD#${shard}`,
    gsi2sk: `NAME#${normalizedName}#ID#${item.id}`,
    ...(isProviderTable(tableName) && item.ownerUserId ? { gsi3pk: `OWNER#${item.ownerUserId}`, gsi3sk: `PROVIDER#${item.id}` } : {}),
    ...(!isMenuTable(tableName) ? { gsi5pk: `NAME#${normalizedName}`, gsi5sk: `DISTRICT#${item.district || 'UNKNOWN'}#ID#${item.id}` } : {}),
  };
}

async function queryPartition(tableName, indexName, partitionName, partitionValue, sortName) {
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

async function queryShards(tableName, indexName, partitionName, partitionForShard, sortName) {
  const results = await Promise.all(Array.from({ length: SHARD_COUNT }, (_, shard) =>
    queryPartition(tableName, indexName, partitionName, partitionForShard(shard), sortName)
  ));
  return results.flat();
}

async function listItems(tableName) {
  if (!enabled) return null;
  await ensureTable(tableName);
  return queryShards(tableName, 'DirectoryIndex', 'gsi2pk', (shard) => {
    const type = isMenuTable(tableName) ? 'MENUS' : isProviderTable(tableName) ? 'PROVIDERS' : 'SCHOOLS';
    return `${type}#SHARD#${shard}`;
  }, 'gsi2sk');
}

async function listItemsByDistrict(tableName, district) {
  if (!enabled) return null;
  if (isMenuTable(tableName)) return [];
  await ensureTable(tableName);
  const type = isProviderTable(tableName) ? 'PROVIDERS' : 'SCHOOLS';
  return queryShards(tableName, 'DistrictIndex', 'gsi1pk', (shard) =>
    `DISTRICT#${district}#ROLE#${type}#SHARD#${shard}`, 'gsi1sk');
}

async function listItemsByProvider(tableName, providerId) {
  if (!enabled) return null;
  await ensureTable(tableName);
  return queryShards(tableName, 'ProviderMenuIndex', 'gsi1pk', (shard) =>
    `PROVIDER#${providerId}#SHARD#${shard}`, 'gsi1sk');
}

async function listProvidersBySchool(tableName, schoolId) {
  if (!enabled) return null;
  await ensureTable(tableName);
  return queryShards(tableName, 'SchoolCoverageIndex', 'gsi4pk', (shard) =>
    `SCHOOL#${schoolId}#SHARD#${shard}`, 'gsi4sk');
}

async function findItemByOwnerUserId(tableName, userId) {
  if (!enabled) return null;
  await ensureTable(tableName);
  const items = await queryPartition(tableName, 'OwnerIndex', 'gsi3pk', `OWNER#${userId}`, 'gsi3sk');
  return items[0] || null;
}

async function findItemsByName(tableName, name) {
  if (!enabled) return null;
  if (isMenuTable(tableName)) return [];
  await ensureTable(tableName);
  return queryPartition(tableName, 'NameIndex', 'gsi5pk', `NAME#${String(name).trim().toLowerCase()}`, 'gsi5sk');
}

async function findItemById(tableName, id) {
  if (!enabled) return null;
  await ensureTable(tableName);
  const result = await client.send(new GetCommand({ TableName: tableName, Key: { id }, ConsistentRead: true }));
  return result.Item || null;
}

async function saveItem(tableName, item) {
  if (!enabled) return;
  await ensureTable(tableName);
  if (!isProviderTable(tableName) || item.entityType === 'SCHOOL_PROVIDER') {
    await client.send(new PutCommand({ TableName: tableName, Item: withIndexKeys(tableName, item) }));
    return;
  }

  const existing = await findItemById(tableName, item.id);
  const previousSchoolIds = new Set(existing?.schoolIds || []);
  const nextSchoolIds = new Set(item.schoolIds || []);
  await client.send(new PutCommand({ TableName: tableName, Item: withIndexKeys(tableName, item) }));
  const removed = [...previousSchoolIds].filter((schoolId) => !nextSchoolIds.has(schoolId));
  const added = [...nextSchoolIds].filter((schoolId) => !previousSchoolIds.has(schoolId));
  await Promise.all([
    ...removed.map((schoolId) => client.send(new DeleteCommand({
      TableName: tableName,
      Key: { id: `COVERAGE#${schoolId}#${item.id}` },
    }))),
    ...added.map((schoolId) => client.send(new PutCommand({
      TableName: tableName,
      Item: withIndexKeys(tableName, {
        id: `COVERAGE#${schoolId}#${item.id}`,
        entityType: 'SCHOOL_PROVIDER',
        schoolId,
        providerId: item.id,
      }),
    }))),
  ]);
}

module.exports = {
  enabled,
  findItemById,
  findItemsByName,
  findItemByOwnerUserId,
  listItems,
  listItemsByDistrict,
  listItemsByProvider,
  listProvidersBySchool,
  saveItem,
  withIndexKeys,
};