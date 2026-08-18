export type DatabaseEngine = "postgres" | "sqlite" | "unknown";

export function detectDatabaseEngine(url = process.env.DATABASE_URL || ""): DatabaseEngine {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgres";
  if (url.startsWith("file:") || url.endsWith(".db") || url.includes("sqlite")) return "sqlite";
  return "unknown";
}

export function databaseEngineLabel(engine: DatabaseEngine): string {
  switch (engine) {
    case "postgres":
      return "Postgres";
    case "sqlite":
      return "SQLite";
    case "unknown":
      return "Unknown engine";
    default: {
      const _never: never = engine;
      return _never;
    }
  }
}
