function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const nextInit = { ...init };
  const method = String(nextInit.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCookieValue("bbc_csrf");
    if (csrf) {
      nextInit.headers = { ...(nextInit.headers || {}), "X-CSRF-Token": csrf };
    }
  }
  return fetch(input, nextInit);
}
