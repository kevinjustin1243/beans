// Same-origin requests; Vite dev server proxies /api → http://localhost:8000.
// In production, serve the built bundle from a path that shares its origin with the API.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}
