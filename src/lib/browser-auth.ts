/** Cookie auth remains available when the browser blocks local storage. */
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem('launched_token');
  } catch {
    return null;
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem('launched_token');
  } catch {
    // Storage can be disabled; the server still expires the session cookie.
  }
}

/** Keep legacy token links usable while removing credentials from browser history. */
export function consumeTokenFromUrl(): void {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  if (!token) return;
  try {
    localStorage.setItem('launched_token', token);
  } catch {
    // A server-issued HttpOnly cookie can still authenticate this browser.
  }
  url.searchParams.delete('token');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getStoredToken();
  const explicitAuthorization = headers.has('Authorization');
  let response = await fetch(url, { ...options, credentials: 'include', headers });
  // OAuth sets an HttpOnly cookie. Prefer it over a legacy token from another account.
  if (response.status === 401 && token && !explicitAuthorization) {
    headers.set('Authorization', `Bearer ${token}`);
    response = await fetch(url, { ...options, credentials: 'include', headers });
  } else if (response.ok && token && !explicitAuthorization) {
    clearStoredToken();
  }
  if (response.status === 401) clearStoredToken();
  return response;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
