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

const buildQuery = (filters = {}) => {
  if (typeof filters === 'string' && filters.trim()) {
    return filters.startsWith('?') ? filters : `?${filters}`;
  }
  const search = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
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
  getAdminUsers: (token, district, role) => {
    const search = new URLSearchParams({ district, role }).toString();
    return request(`${urls.identity}/api/admin/users?${search}`, {}, token);
  },
  updateAdminUserStatus: (userId, status, token) =>
    request(`${urls.identity}/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token),

  // Providers
  getProviders: (filters = {}) => request(`${urls.provider}/api/providers${buildQuery(filters)}`),
  getProvider: (id) => request(`${urls.provider}/api/providers/${id}`),
  getAdminProviders: (token, district) => request(`${urls.provider}/api/admin/providers?${new URLSearchParams({ district })}`, {}, token),
  updateAdminProviderStatus: (id, status, token) =>
    request(`${urls.provider}/api/admin/providers/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token),
  getAdminSchools: (token, district) => request(`${urls.provider}/api/admin/schools?${new URLSearchParams({ district })}`, {}, token),
  updateAdminSchoolStatus: (id, status, token) =>
    request(`${urls.provider}/api/admin/schools/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token),
  submitProviderRating: (providerId, rating, token) =>
    request(
      `${urls.provider}/api/providers/${providerId}/ratings`,
      { method: 'POST', body: JSON.stringify({ rating }) },
      token
    ),
  getMyMenu: (token) => request(`${urls.provider}/api/my/menu`, {}, token),
  updateProviderProfile: (providerId, profile, token) =>
    request(
      `${urls.provider}/api/providers/${providerId}/profile`,
      { method: 'PUT', body: JSON.stringify(profile) },
      token
    ),
  registerProvider: (provider, token) =>
    request(
      `${urls.provider}/api/providers`,
      {
        method: 'POST',
        body: JSON.stringify(provider),
      },
      token
    ),
  updateProviderSchools: (providerId, schoolIds, token) =>
    request(
      `${urls.provider}/api/providers/${providerId}/schools`,
      {
        method: 'PUT',
        body: JSON.stringify({ schoolIds }),
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
  updateMenuItem: (providerId, menuId, item, token) =>
    request(
      `${urls.provider}/api/providers/${providerId}/menu/${menuId}`,
      {
        method: 'PUT',
        body: JSON.stringify(item),
      },
      token
    ),
  updateMenuAvailability: (providerId, menuId, available, token) =>
    request(
      `${urls.provider}/api/providers/${providerId}/menu/${menuId}/availability`,
      {
        method: 'PUT',
        body: JSON.stringify({ available }),
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
  getOrders: (token, filters = {}) => {
    const search = new URLSearchParams(filters).toString();
    return request(`${urls.order}/api/orders${search ? `?${search}` : ''}`, {}, token);
  },
  getPayments: (token, filters = {}) => {
    const search = new URLSearchParams(filters).toString();
    return request(`${urls.order}/api/payments${search ? `?${search}` : ''}`, {}, token);
  },
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
  getSchools: (filters = {}) => request(`${urls.provider}/api/schools${buildQuery(filters)}`),
  getSchool: (id) => request(`${urls.provider}/api/schools/${id}`),
  getSchoolProviders: (id, token) => request(`${urls.provider}/api/schools/${id}/providers`, {}, token),
  updateSchool: (id, school, token) =>
    request(`${urls.provider}/api/schools/${id}`, { method: 'PUT', body: JSON.stringify(school) }, token),
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