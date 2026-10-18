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

  return db_url;
}
