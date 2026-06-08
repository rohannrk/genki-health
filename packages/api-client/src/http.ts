// ---------------------------------------------------------------------------
// Shared HTTP helpers
// ---------------------------------------------------------------------------

export function getBaseUrl() {
  return process.env.EXPO_PUBLIC_API_URL || 'https://api.medcopilot.in';
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  // 204 No Content (and other empty bodies) have nothing to parse.
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function get<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  return parse<T>(response);
}

export async function post<T>(path: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parse<T>(response);
}

export async function patch<T>(path: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parse<T>(response);
}

export async function del<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parse<T>(response);
}
