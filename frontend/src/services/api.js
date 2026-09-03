const serviceUrl = (specificUrl, fallbackUrl) => {
  if (specificUrl) {
    return specificUrl.replace(/\/$/, '');
  }

  return fallbackUrl;
};

const urls = {
  identity: serviceUrl(process.env.NEXT_PUBLIC_IDENTITY_API_URL, 'http://localhost:3002'),
  provider: serviceUrl(process.env.NEXT_PUBLIC_PROVIDER_API_URL, 'http://localhost:3003'),
  order: serviceUrl(process.env.NEXT_PUBLIC_ORDER_API_URL, 'http://localhost:3004')
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'The request could not be completed.');
  }

  return payload;
}

export const api = {
  login: (credentials) => request(`${urls.identity}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials)
  }),
  register: (user) => request(`${urls.identity}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify(user)
  }),
  getProviders: () => request(`${urls.provider}/api/providers`),
  getMenu: (providerId) => request(`${urls.provider}/api/providers/${providerId}/menu`),
  registerProvider: (provider) => request(`${urls.provider}/api/providers`, {
    method: 'POST',
    body: JSON.stringify(provider)
  }),
  createMenuItem: (providerId, item) => request(`${urls.provider}/api/providers/${providerId}/menu`, {
    method: 'POST',
    body: JSON.stringify(item)
  }),
  createOrder: (order) => request(`${urls.order}/api/orders`, {
    method: 'POST',
    body: JSON.stringify(order)
  })
};
