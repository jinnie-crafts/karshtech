import type { IDatabaseProvider } from './IDatabaseProvider.js';
import { JsonDatabaseProvider } from './JsonDatabaseProvider.js';
import { SupabasePostgresProvider } from './SupabasePostgresProvider.js';

export function resolveProviderType(): 'postgres' | 'json' {
  const envProvider = process.env.DB_PROVIDER?.trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';

  if (envProvider) {
    if (envProvider === 'postgres' || envProvider === 'postgresql') {
      return 'postgres';
    }
    if (envProvider === 'json') {
      return 'json';
    }
    throw new Error(
      `[Database Factory FATAL] Invalid DB_PROVIDER="${process.env.DB_PROVIDER}". Allowed values are 'postgres' or 'json'.`
    );
  }

  // If DB_PROVIDER is omitted:
  // Production strictly defaults to postgres
  if (isProduction) {
    return 'postgres';
  }

  // Development defaults to json
  return 'json';
}

export function createDatabaseProvider(): IDatabaseProvider {
  const providerType = resolveProviderType();

  if (providerType === 'postgres') {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        '[Database Factory FATAL] DATABASE_URL is missing or empty. When running with PostgreSQL (or in production), DATABASE_URL is mandatory. Silent fallback to JSON is strictly disabled.'
      );
    }
    console.log('[Database Factory] Selecting Supabase PostgreSQL Provider (production-grade pool).');
    return new SupabasePostgresProvider();
  }

  if (providerType === 'json') {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[Database Factory WARNING] Explicit DB_PROVIDER=json selected in PRODUCTION mode. Using JSON database engine.'
      );
    } else {
      console.log('[Database Factory] Selecting JSON Database Provider (development/rollback mode).');
    }
    return new JsonDatabaseProvider();
  }

  throw new Error(`[Database Factory FATAL] Unhandled provider type: ${providerType}`);
}
