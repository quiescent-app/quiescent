export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export function getDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const db_url = environment["DATABASE_URL"];

  if (!db_url) {
    throw new DatabaseConfigurationError(
      `DATABASE_URL is required to connect to PostgreSQL`,
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(db_url);
  } catch {
    throw new DatabaseConfigurationError("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    !parsedUrl.pathname ||
    parsedUrl.pathname === "/"
  ) {
    throw new DatabaseConfigurationError("DATABASE_URL must be a valid PostgreSQL URL");
  }

  return db_url;
}
