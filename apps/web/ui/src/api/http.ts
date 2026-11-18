/// <reference types="vite/client" />

/** An API request failure with a message and HTTP status code. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? "http://localhost:3000" : "");

/** Builds an absolute API URL, using localhost as the development fallback. */
export function apiUrl(path: string): string {
  if (!apiBaseUrl) throw new Error("VITE_API_BASE_URL must be configured for production builds");
  return new URL(path.replace(/^\//, ""), `${apiBaseUrl.replace(/\/$/, "")}/`).toString();
}

/** Reads a JSON response and throws ApiError for an unsuccessful HTTP status. */
export async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload &&
      payload.error && typeof payload.error === "object" && "message" in payload.error &&
      typeof payload.error.message === "string"
      ? payload.error.message
      : "The request could not be completed. Try again.";
    throw new ApiError(message, response.status);
  }
  return payload as T;
}
