const serviceUrl = (specificUrl, fallbackUrl) => {
  if (specificUrl) {
    return specificUrl.replace(/\/$/, '');
  }
  return fallbackUrl;
};

const urls = {
  identity: serviceUrl(process.env.NEXT_PUBLIC_IDENTITY_API_URL, 'http://localhost:3002'),
  provider: serviceUrl(process.env.NEXT_PUBLIC_PROVIDER_API_URL, 'http://localhost:3003'),
  order: serviceUrl(process.env.NEXT_PUBLIC_ORDER_API_URL, 'http://localhost:3004'),
};

async function request(url, options = {}, token) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || payload.message || 'Request failed');
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  // Auth
  login: (credentials) =>
    request(`${urls.identity}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (user) =>
    request(`${urls.identity}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify(user),
    }),

  // Providers
  getProviders: () => request(`${urls.provider}/api/providers`),
  getProvider: (id) => request(`${urls.provider}/api/providers/${id}`),
  registerProvider: (provider, token) =>
    request(
      `${urls.provider}/api/providers`,
      {
        method: 'POST',
        body: JSON.stringify(provider),
      },
      token
    ),

  // Menu
  getMenu: (providerId) =>
    request(`${urls.provider}/api/providers/${providerId}/menu`),
  getFeaturedMenu: () => request(`${urls.provider}/api/menu/featured`),
  createMenuItem: (providerId, item, token) =>
    request(
      `${urls.provider}/api/providers/${providerId}/menu`,
      {
        method: 'POST',
        body: JSON.stringify(item),
      },
      token
    ),

  // Orders
  createOrder: (order, token) =>
    request(
      `${urls.order}/api/orders`,
      {
        method: 'POST',
        body: JSON.stringify(order),
      },
      token
    ),
  getOrders: (token) => request(`${urls.order}/api/orders`, {}, token),
  getOrder: (id, token) => request(`${urls.order}/api/orders/${id}`, {}, token),
  updateOrderStatus: (id, status, token) =>
    request(
      `${urls.order}/api/orders/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      token
    ),

  // Schools
  getSchools: () => request(`${urls.provider}/api/schools`),
  getSchool: (id) => request(`${urls.provider}/api/schools/${id}`),
  registerSchool: (school, token) =>
    request(
      `${urls.provider}/api/schools`,
      {
        method: 'POST',
        body: JSON.stringify(school),
      },
      token
    ),
};