export * from './database/types.js';
export * from './database/IDatabaseProvider.js';
export * from './database/JsonDatabaseProvider.js';
export * from './database/SupabasePostgresProvider.js';
export * from './database/databaseFactory.js';

import type { IDatabaseProvider } from './database/IDatabaseProvider.js';
import { createDatabaseProvider } from './database/databaseFactory.js';

let currentProvider: IDatabaseProvider | null = null;

export function getDatabaseProvider(): IDatabaseProvider {
  if (!currentProvider) {
    currentProvider = createDatabaseProvider();
  }
  return currentProvider;
}

export function setDatabaseProvider(provider: IDatabaseProvider): void {
  currentProvider = provider;
}

/**
 * Transparent proxy for IDatabaseProvider.
 * Forwards all calls to the active provider while allowing runtime switching in tests.
 */
export const db: IDatabaseProvider = new Proxy({} as IDatabaseProvider, {
  get(_target, prop) {
    const active = getDatabaseProvider();
    const value = (active as any)[prop];
    if (typeof value === 'function') {
      return value.bind(active);
    }
    return value;
  },
});
