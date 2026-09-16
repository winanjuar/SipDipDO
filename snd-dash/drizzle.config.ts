import { defineConfig } from 'drizzle-kit'

// Schema + migrations live under drizzle/ (task 4.1 fills in the schema).
export default defineConfig({
  dialect: 'postgresql',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
