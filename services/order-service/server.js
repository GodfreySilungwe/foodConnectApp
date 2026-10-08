const express = require('express');
const { randomUUID } = require('node:crypto');
const { createOrderRepository, createPaymentRepository } = require('./repositories');
const { requireAuth } = require('./auth');
const { toIsoTimestamp } = require('./schema');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REPORT_DAYS = 31;

function parseDateRange(query) {
  if (query.date !== undefined) {
    if (typeof query.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
      throw new Error('date must use YYYY-MM-DD format');
    }
    const from = new Date(`${query.date}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || from.toISOString().slice(0, 10) !== query.date) {
      throw new Error('date must be a valid calendar date');
    }
    return {
      date: query.date,
      from: from.toISOString(),
      to: new Date(from.getTime() + DAY_MS - 1).toISOString(),
    };
  }

  if (query.from === undefined && query.to === undefined) {
    const to = new Date();
    return { from: new Date(to.getTime() - 30 * DAY_MS).toISOString(), to: to.toISOString() };
  }
  if (query.from === undefined || query.to === undefined) {
    throw new Error('Both from and to timestamps are required');
  }

  const from = toIsoTimestamp(query.from);
  const to = toIsoTimestamp(query.to);
  const rangeMs = Date.parse(to) - Date.parse(from);
  if (rangeMs < 0) throw new Error('from must be earlier than or equal to to');
  if (rangeMs > MAX_REPORT_DAYS * DAY_MS) throw new Error('Date range cannot exceed 31 days');
  return { from, to };
}

const allowedTransitions = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  cancelled: []
};

const createApp = () => {
  const app = express();
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json());

  const orderRepository = createOrderRepository([
    {
      id: 'o-1001',
      customerId: 'u-001',
      providerId: 'p-001',
      status: 'pending',
      total: 42.5
    }
  ]);
  const paymentRepository = createPaymentRepository();

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'order-service' });
  });

  app.get('/api/orders', requireAuth(), async (req, res) => {
    let dateRange;
    try {
      dateRange = parseDateRange(req.query);
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    const filteredOrders = req.user.role === 'admin' || req.user.role === 'superadmin'
      ? await orderRepository.list(dateRange.from, dateRange.to)
      : req.user.role === 'provider' && req.user.providerId
      ? dateRange.date
        ? await orderRepository.listByKitchenDate(req.user.providerId, dateRange.date, dateRange.from, dateRange.to)
        : await orderRepository.listByProvider(req.user.providerId, dateRange.from, dateRange.to)
      : req.user.role === 'customer'
      ? await orderRepository.listByCustomer(req.user.userId, dateRange.from, dateRange.to)
      : [];
    res.json({ success: true, data: filteredOrders });
  });

  app.patch('/api/orders/:orderId/status', requireAuth('provider'), async (req, res) => {
    const { status } = req.body || {};
    if (!req.user.providerId) {
      return res.status(403).json({ success: false, error: 'Provider account is not linked to a provider' });
    }

    const order = await orderRepository.findById(req.params.orderId);

    if (!status || !order || order.providerId !== req.user.providerId || !allowedTransitions[order.status]?.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status transition' });
    }

    const updatedOrder = await orderRepository.updateStatus(order.id, status);
    return res.json({ success: true, data: updatedOrder, message: 'Order status updated successfully' });
  });

  app.get('/api/payments', requireAuth('provider'), async (req, res) => {
    if (!req.user.providerId) {
      return res.status(403).json({ success: false, error: 'Provider account is not linked to a kitchen' });
    }

    let dateRange;
    try {
      dateRange = parseDateRange(req.query);
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    const payments = dateRange.date
      ? await paymentRepository.listByKitchenDate(req.user.providerId, dateRange.date, dateRange.from, dateRange.to)
      : await paymentRepository.listByProvider(req.user.providerId, dateRange.from, dateRange.to);
    return res.json({ success: true, data: payments });
  });

  app.get('/api/orders/:orderId/payments', requireAuth('provider'), async (req, res) => {
    const order = await orderRepository.findById(req.params.orderId);
    if (!order || order.providerId !== req.user.providerId) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    const payments = await paymentRepository.listByOrder(order.id);
    return res.json({ success: true, data: payments });
  });

  app.post('/api/orders', requireAuth('customer'), async (req, res) => {
    const { providerId, items, scheduledFor, deliveryType, studentName, studentClass, schoolId, schoolName, foodPreferences } = req.body || {};
    const customerId = req.user.userId;

    if (!customerId || !providerId || !Array.isArray(items) || items.length === 0 || !studentName?.trim() || !studentClass?.trim() || !schoolId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['providerId, studentName, studentClass, schoolId, and at least one item are required']
      });
    }

    const total = items.reduce((sum, item) => {
      const itemPrice = Number(item.price || 0);
      return sum + itemPrice * Number(item.quantity || 0);
    }, 0);

    const createdAt = new Date().toISOString();
    let serviceAt;
    try {
      serviceAt = toIsoTimestamp(scheduledFor || createdAt);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'scheduledFor must be a valid ISO-8601 timestamp' });
    }

    const newOrder = {
      id: `o-${randomUUID()}`,
      customerId,
      district: req.user.district || null,
      providerId,
      items,
      studentName: studentName.trim(),
      studentClass: studentClass.trim(),
      schoolId: schoolId.trim(),
      schoolName: schoolName?.trim() || null,
      foodPreferences: foodPreferences?.trim() || '',
      scheduledFor: scheduledFor ? serviceAt : null,
      serviceAt,
      createdAt,
      deliveryType: deliveryType || 'collection',
      status: 'pending',
      total
    };

    await orderRepository.save(newOrder);

    return res.status(201).json({
      success: true,
      data: newOrder,
      message: 'Order created successfully'
    });
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3004;
  app.listen(PORT, () => {
    console.log(`Order service listening on port ${PORT}`);
  });
}

module.exports = createApp();
