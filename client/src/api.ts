export async function api(path: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...opts, headers, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || res.statusText);
    (err as Error & { status: number; data: unknown }).status = res.status;
    (err as Error & { data: unknown }).data = data;
    throw err;
  }
  return data;
}
