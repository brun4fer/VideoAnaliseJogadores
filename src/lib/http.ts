export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "O pedido não pôde ser concluído.");
  return payload as T;
}
