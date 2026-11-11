const DEVELOPMENT_WEB_ORIGIN = "http://localhost:5173";

export function getWebOrigin(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment["WEB_ORIGIN"] ??
    (environment["NODE_ENV"] === "production" ? undefined : DEVELOPMENT_WEB_ORIGIN);

  if (!value) throw new Error("WEB_ORIGIN is required in production");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("WEB_ORIGIN must be a valid origin");
  }

  if (parsed.origin !== value || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new Error("WEB_ORIGIN must not include a path, query, or fragment");
  }

  return parsed.origin;
}
