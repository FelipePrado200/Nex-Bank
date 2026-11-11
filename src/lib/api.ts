export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  ok?: boolean;
  data?: T;
  error?: string;
}

let refreshing: Promise<boolean> | null = null;

/** One shared refresh call, so parallel requests do not rotate the token twice. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { session?: boolean } = {}
): Promise<T> {
  const useSession = options.session ?? true;
  let res = await send(method, path, body);

  if (useSession && res.status === 401) {
    if (await refreshSession()) {
      res = await send(method, path, body);
    }
    if (res.status === 401) {
      if (typeof window !== "undefined") window.location.assign("/login");
      throw new ApiError("Sessão expirada. Entre novamente.", 401);
    }
  }

  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok) throw new ApiError(json.error ?? `Erro ${res.status}`, res.status);
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown, options?: { session?: boolean }) =>
    request<T>("POST", path, body, options),
};

export function errorMessage(error: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  return error instanceof Error ? error.message : fallback;
}
