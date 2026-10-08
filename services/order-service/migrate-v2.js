const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { withUserKeys } = require('../identity-service/schema');
const { withIndexKeys } = require('../provider-service/dynamo');
const { withOrderKeys } = require('./schema');

const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;
const region = process.env.AWS_REGION || 'ap-southeast-1';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  endpoint,
  region,
  credentials: endpoint ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeMyKeyId',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeSecretAccessKey',
  } : undefined,
  maxAttempts: 3,
}));
const applyChanges = process.argv.includes('--apply');

const tables = [
  {
    label: 'users',
    source: process.env.LEGACY_USERS_TABLE || 'foodconnect-dev-users',
    target: process.env.USERS_TABLE || 'foodconnect-dev-users-v2',
    transform: (item) => {
      const user = withUserKeys({
        ...item,
        id: item.id || item.userId,
        district: item.district || 'UNKNOWN',
        email: String(item.email).trim().toLowerCase(),
      });
      return [user, {
        id: `EMAIL#${user.email}`,
        entityType: 'EMAIL',
        userId: user.id,
        email: user.email,
      }];
    },
  },
  {
    label: 'providers',
    source: process.env.LEGACY_PROVIDERS_TABLE || 'foodconnect-dev-providers',
    target: process.env.PROVIDERS_TABLE || 'foodconnect-dev-providers-v2',
    transform: (item, target) => [
      withIndexKeys(target, { ...item, id: item.id || item.providerId, district: item.district || 'UNKNOWN' }),
      ...(item.schoolIds || []).map((schoolId) => withIndexKeys(target, {
        id: `COVERAGE#${schoolId}#${item.id || item.providerId}`,
        entityType: 'SCHOOL_PROVIDER',
        schoolId,
        providerId: item.id || item.providerId,
      })),
    ],
  },
  {
    label: 'menus',
    source: process.env.LEGACY_MENUS_TABLE || 'foodconnect-dev-menus',
    target: process.env.MENUS_TABLE || 'foodconnect-dev-menus-v2',
    transform: (item, target) => [withIndexKeys(target, { ...item, id: item.id || item.menuId })],
  },
  {
    label: 'schools',
    source: process.env.LEGACY_SCHOOLS_TABLE || 'foodconnect-dev-schools',
    target: process.env.SCHOOLS_TABLE || 'foodconnect-dev-schools-v2',
    transform: (item, target, context) => {
      const schoolId = item.id || item.schoolId;
      return [withIndexKeys(target, {
        ...item,
        id: schoolId,
        district: item.district || 'UNKNOWN',
        providerCount: context.providerCounts.get(schoolId) || 0,
      })];
    },
  },
  {
    label: 'orders',
    source: process.env.LEGACY_ORDERS_TABLE || 'foodconnect-dev-orders',
    target: process.env.ORDERS_TABLE || 'foodconnect-dev-orders-v2',
    transform: (item) => item.scheduledFor || item.serviceAt || item.createdAt
      ? [withOrderKeys({ ...item, id: item.id || item.orderId })]
      : [],
  },
];

async function scanAll(tableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await client.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function writeBatch(tableName, items) {
  for (let start = 0; start < items.length; start += 25) {
    let pending = items.slice(start, start + 25);
    for (let attempt = 0; pending.length && attempt < 6; attempt += 1) {
      const result = await client.send(new BatchWriteCommand({
        RequestItems: { [tableName]: pending.map((Item) => ({ PutRequest: { Item } })) },
      }));
      pending = result.UnprocessedItems?.[tableName] || [];
      if (pending.length) await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    }
    if (pending.length) throw new Error(`DynamoDB kept throttling writes to ${tableName}`);
  }
}

async function main() {
  const legacyUsers = await scanAll(tables[0].source);
  const legacyProviders = await scanAll(tables[1].source);
  const userByEmail = new Map();
  for (const user of legacyUsers) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) continue;
    const existingUserId = userByEmail.get(email);
    const userId = user.id || user.userId;
    if (existingUserId && existingUserId !== userId) {
      throw new Error(`Duplicate normalized email ${email}; resolve it before migration`);
    }
    userByEmail.set(email, userId);
  }
  const providerCounts = new Map();
  for (const provider of legacyProviders) {
    if (provider.status && provider.status !== 'active') continue;
    for (const schoolId of provider.schoolIds || []) {
      providerCounts.set(schoolId, (providerCounts.get(schoolId) || 0) + 1);
    }
  }

  for (const table of tables) {
    const sourceItems = table.label === 'users'
      ? legacyUsers
      : table.label === 'providers'
        ? legacyProviders
        : await scanAll(table.source);
    const targetItems = sourceItems.flatMap((item) => table.transform(item, table.target, { providerCounts }));
    console.log(`${table.label}: ${sourceItems.length} source records -> ${targetItems.length} v2 records${table.label === 'orders' ? `; ${sourceItems.length - targetItems.length} skipped because they have no trustworthy service timestamp` : ''}`);
    if (applyChanges && targetItems.length) await writeBatch(table.target, targetItems);
  }

  if (!applyChanges) {
    console.log('Dry run only. Review counts, back up tables, provision v2 targets, then rerun with --apply.');
  } else {
    console.log('Backfill complete. Legacy tables were not changed. Verify v2 reads before switching traffic.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
