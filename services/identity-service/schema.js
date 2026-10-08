const { createHash } = require('node:crypto');

const SHARD_COUNT = 16;

function shardForId(id) {
  return createHash('sha256').update(String(id)).digest().readUInt32BE(0) % SHARD_COUNT;
}

function withUserKeys(user) {
  const shard = shardForId(user.id);
  const district = user.district || 'UNKNOWN';
  const role = user.role || 'UNKNOWN';
  return {
    ...user,
    gsi1pk: `DISTRICT#${district}#ROLE#${role}#SHARD#${shard}`,
    gsi1sk: `CREATED#${user.createdAt || '1970-01-01T00:00:00.000Z'}#USER#${user.id}`,
    gsi2pk: `USERS#SHARD#${shard}`,
    gsi2sk: `ROLE#${role}#DISTRICT#${district}#USER#${user.id}`,
  };
}

module.exports = { SHARD_COUNT, shardForId, withUserKeys };
