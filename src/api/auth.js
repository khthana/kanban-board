const BASE_URL = process.env.REACT_APP_API_URL || '';

// ── token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'kanban_token';
const REFRESH_TOKEN_KEY = 'kanban_refresh_token';

export function getToken()          { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t)         { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken()        { localStorage.removeItem(TOKEN_KEY); }

export function getRefreshToken()   { return localStorage.getItem(REFRESH_TOKEN_KEY); }
export function setRefreshToken(t)  { localStorage.setItem(REFRESH_TOKEN_KEY, t); }
export function clearRefreshToken() { localStorage.removeItem(REFRESH_TOKEN_KEY); }

// ── refresh logic ─────────────────────────────────────────────────────────────

// Single in-flight refresh — concurrent 401s all await the same promise
let refreshPromise = null;

async function attemptRefresh() {
  if (refreshPromise) return refreshPromise;
  const rt = getRefreshToken();
  if (!rt) throw new Error('no refresh token');

  refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  }).then(async res => {
    if (!res.ok) throw new Error('refresh failed');
    const { token } = await res.json();
    setToken(token);
  }).finally(() => { refreshPromise = null; });

  return refreshPromise;
}

// ── core fetch helper ─────────────────────────────────────────────────────────

export async function apiFetch(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    if (path !== '/auth/refresh' && getRefreshToken()) {
      try {
        await attemptRefresh();
        return apiFetch(method, path, body);
      } catch {
        // refresh failed — fall through to clear + redirect
      }
    }
    clearToken();
    clearRefreshToken();
    window.location.replace('/login');
    throw Object.assign(new Error('Session expired'), { status: 401 });
  }

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  }
  return data;
}
