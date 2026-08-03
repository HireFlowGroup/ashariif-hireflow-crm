export const API_VERSION = "v1" as const;

export type ApiVersion = typeof API_VERSION;

export function parseApiVersion(request: Request): ApiVersion {
  const header = request.headers.get("x-api-version")?.trim();
  if (header === "v1" || !header) return "v1";
  throw new Error(`Unsupported API version: ${header}`);
}

export function withVersionHeaders(response: Response, version: ApiVersion = API_VERSION): Response {
  const headers = new Headers(response.headers);
  headers.set("x-api-version", version);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
