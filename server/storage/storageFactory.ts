import type { IStorageService } from './storageTypes.js';
import { SupabaseStorageService } from './SupabaseStorageService.js';

let storageInstance: IStorageService | null = null;

function initStorageInstance(): IStorageService {
  if (storageInstance) return storageInstance;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!supabaseUrl || !supabaseKey) {
    if (isProduction) {
      throw new Error(
        '[Storage Factory FATAL] SUPABASE_URL and SUPABASE_SECRET_KEY are required for Supabase Storage in production environment.'
      );
    }
    console.warn(
      '[Storage Factory WARNING] SUPABASE_URL or SUPABASE_SECRET_KEY is missing. Storage uploads in local development may fail or require configuration.'
    );
  }

  storageInstance = new SupabaseStorageService(supabaseUrl, supabaseKey);
  return storageInstance;
}

export function createStorageService(): IStorageService {
  return new Proxy({} as IStorageService, {
    get(_target, prop: string | symbol) {
      const active = storageInstance || initStorageInstance();
      const val = (active as any)[prop];
      if (typeof val === 'function') {
        return val.bind(active);
      }
      return val;
    },
  });
}

export function setStorageService(service: IStorageService): void {
  storageInstance = service;
}
