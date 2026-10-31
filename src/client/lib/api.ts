let csrfToken = "";
let sessionRequest: Promise<unknown> | undefined;

export function clearSession() {
  csrfToken = "";
}

function loadSession<T>(): Promise<T> {
  sessionRequest ??= request("/api/auth/me").finally(() => {
    sessionRequest = undefined;
  });
  return sessionRequest as Promise<T>;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method || "GET";
  if (path === "/api/auth/me" && method === "GET") return loadSession<T>();
  if (!["GET", "HEAD"].includes(method) && (!csrfToken || sessionRequest))
    await loadSession();
  return request<T>(path, options);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method || "GET";
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(!["GET", "HEAD"].includes(method)
        ? { "X-CSRF-Token": csrfToken }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : data.message || "请求失败",
    );
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data as T;
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
