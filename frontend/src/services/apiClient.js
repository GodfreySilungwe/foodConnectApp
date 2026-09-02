const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

export async function fetchProviders() {
  const response = await fetch(`${API_BASE_URL}/api/providers`);
  return response.json();
}
