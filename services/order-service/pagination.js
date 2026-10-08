const { createHmac, timingSafeEqual } = require('node:crypto');

const cursorSecret = process.env.CURSOR_SECRET || process.env.JWT_SECRET || 'foodconnect-development-secret';

function encodeCursor(scope, state) {
  const payload = Buffer.from(JSON.stringify({ version: 1, scope, state })).toString('base64url');
  const signature = createHmac('sha256', cursorSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeCursor(cursor, scope, shardCount) {
  if (!cursor) return { positions: Array(shardCount).fill(null), done: Array(shardCount).fill(false) };
  const [payload, signature, extra] = String(cursor).split('.');
  if (!payload || !signature || extra) throw new Error('Invalid page cursor');
  const expected = createHmac('sha256', cursorSecret).update(payload).digest();
  let received;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    throw new Error('Invalid page cursor');
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('Invalid page cursor');

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw new Error('Invalid page cursor');
  }
  if (decoded.version !== 1 || decoded.scope !== scope || !Array.isArray(decoded.state?.positions) || !Array.isArray(decoded.state?.done) || decoded.state.positions.length !== shardCount || decoded.state.done.length !== shardCount) {
    throw new Error('Page cursor does not match this query');
  }
  return decoded.state;
}

module.exports = { decodeCursor, encodeCursor };
