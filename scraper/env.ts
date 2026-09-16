// Imported first by the entry point so config reads the same variables CI sets.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No local file: CI passes the variables directly.
}
