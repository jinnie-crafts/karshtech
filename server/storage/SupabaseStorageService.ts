import { Readable } from 'stream';
import crypto from 'crypto';
import type {
  IStorageService,
  StorageBucket,
  UploadOptions,
  UploadResult,
  ObjectMetadata,
  DownloadStreamResult,
} from './storageTypes.js';
import { PROTECTED_STORAGE_OBJECTS } from './storageConfig.js';

export class SupabaseStorageService implements IStorageService {
  private supabaseUrl: string;
  private supabaseKey: string;
  private initialized = false;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || process.env.SUPABASE_URL;
    const key = supabaseKey || process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      throw new Error(
        '[Storage FATAL] SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in environment for SupabaseStorageService'
      );
    }

    this.supabaseUrl = url.replace(/\/+$/, '');
    this.supabaseKey = key.trim();
  }

  private getAuthHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.supabaseKey,
      Authorization: `Bearer ${this.supabaseKey}`,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Lightweight verification of storage service connectivity
      const res = await fetch(`${this.supabaseUrl}/storage/v1/bucket`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status} from Storage API: ${errorText}`);
      }

      const buckets = (await res.json()) as Array<{ id: string; public: boolean }>;
      const bucketIds = new Set(buckets.map((b) => b.id));
      const requiredBuckets: StorageBucket[] = ['game-assets', 'product-assets', 'release-apks'];
      const missing = requiredBuckets.filter((b) => !bucketIds.has(b));

      if (missing.length > 0) {
        throw new Error(`Missing expected Supabase Storage bucket(s): ${missing.join(', ')}`);
      }

      this.initialized = true;
      console.log(
        '[Storage] Supabase Storage Service initialized and verified (3/3 buckets: game-assets, product-assets, release-apks).'
      );
    } catch (err: any) {
      console.error('[Storage FATAL] Failed to initialize Supabase Storage Service:', err.message);
      throw err;
    }
  }

  public getBucketVisibility(bucket: StorageBucket): 'public' | 'private' {
    return bucket === 'release-apks' ? 'private' : 'public';
  }

  public getPublicUrl(bucket: StorageBucket, objectPath: string): string {
    const cleanPath = objectPath.replace(/^\/+/, '');
    if (bucket === 'release-apks') {
      throw new Error('[Security Violation] Cannot generate public URL for private bucket "release-apks"');
    }
    return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }

  public async upload(options: UploadOptions): Promise<UploadResult> {
    const { bucket, path: rawPath, buffer, contentType, preventOverwrite = true } = options;
    const cleanPath = rawPath.replace(/^\/+/, '');

    const endpoint = `${this.supabaseUrl}/storage/v1/object/${bucket}/${cleanPath}`;
    const headers = this.getAuthHeaders(contentType);

    if (preventOverwrite) {
      headers['x-upsert'] = 'false';
    } else {
      headers['x-upsert'] = 'true';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: new Uint8Array(buffer),
    });

    if (res.status === 409) {
      // Object already exists: check metadata to see if cryptographically identical
      const existingMeta = await this.getObjectMetadata(bucket, cleanPath);
      if (!existingMeta) {
        throw new Error(
          `[Storage Conflict] Object "${cleanPath}" already exists in bucket "${bucket}" (HTTP 409), but metadata lookup failed. Overwriting is disabled.`
        );
      }

      if (existingMeta.size !== buffer.length) {
        throw new Error(
          `[Storage Conflict] Object "${cleanPath}" already exists in bucket "${bucket}" with different size (HTTP 409). Overwriting is disabled.`
        );
      }

      // Cryptographic hash validation (ETag / MD5 comparison)
      const candidateMd5 = crypto.createHash('md5').update(buffer).digest('hex').toLowerCase();
      const cleanETag = (existingMeta.eTag || '').replace(/['"]/g, '').toLowerCase();

      // Supabase/S3 standard ETag for single uploads is the 32-character hex MD5
      const isVerifiedHashMatch = cleanETag.length === 32 && cleanETag === candidateMd5;

      if (isVerifiedHashMatch) {
        console.log(
          `[Storage] Object "${cleanPath}" already exists in bucket "${bucket}" with verified identical content (MD5 match). Reusing.`
        );
        const url =
          bucket === 'release-apks'
            ? `/api/releases/download` // Internal reference
            : this.getPublicUrl(bucket, cleanPath);

        return {
          success: true,
          bucket,
          path: cleanPath,
          url,
          size: existingMeta.size,
          contentType: existingMeta.contentType || contentType,
          eTag: existingMeta.eTag,
        };
      }

      // Equal file size alone cannot prove identical content; reject safely
      throw new Error(
        `[Storage Conflict] Object "${cleanPath}" already exists in bucket "${bucket}" with different or unverified content (HTTP 409). Overwriting is disabled.`
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[Storage Error] Failed to upload to "${bucket}/${cleanPath}": HTTP ${res.status} - ${errText}`);
    }

    const json = (await res.json().catch(() => ({}))) as any;
    const url =
      bucket === 'release-apks'
        ? `/api/releases/download`
        : this.getPublicUrl(bucket, cleanPath);

    return {
      success: true,
      bucket,
      path: cleanPath,
      url,
      size: buffer.length,
      contentType,
      eTag: json.ETag || res.headers.get('etag') || undefined,
    };
  }

  public async getObjectMetadata(bucket: StorageBucket, objectPath: string): Promise<ObjectMetadata | null> {
    const cleanPath = objectPath.replace(/^\/+/, '');
    const dir = cleanPath.includes('/') ? cleanPath.substring(0, cleanPath.lastIndexOf('/')) : '';
    const filename = cleanPath.includes('/') ? cleanPath.substring(cleanPath.lastIndexOf('/') + 1) : cleanPath;

    const listEndpoint = `${this.supabaseUrl}/storage/v1/object/list/${bucket}`;
    const res = await fetch(listEndpoint, {
      method: 'POST',
      headers: this.getAuthHeaders('application/json'),
      body: JSON.stringify({
        prefix: dir,
        search: filename,
        limit: 10,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const items = (await res.json()) as Array<{
      name: string;
      id?: string;
      metadata?: { size?: number; mimetype?: string; eTag?: string };
      created_at?: string;
      updated_at?: string;
    }>;

    const matched = items.find((item) => item.name === filename);
    if (!matched) return null;

    return {
      name: matched.name,
      id: matched.id,
      size: Number(matched.metadata?.size) || 0,
      contentType: matched.metadata?.mimetype,
      createdAt: matched.created_at,
      updatedAt: matched.updated_at,
      eTag: matched.metadata?.eTag,
    };
  }

  public async downloadPrivate(bucket: StorageBucket, objectPath: string): Promise<DownloadStreamResult> {
    const cleanPath = objectPath.replace(/^\/+/, '');
    const endpoint = `${this.supabaseUrl}/storage/v1/object/authenticated/${bucket}/${cleanPath}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (res.status === 404) {
      throw new Error(`[Storage 404] Object "${cleanPath}" was not found in bucket "${bucket}"`);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[Storage Error] Failed to retrieve "${bucket}/${cleanPath}": HTTP ${res.status} - ${errText}`);
    }

    if (!res.body) {
      throw new Error(`[Storage Error] Empty response body stream for "${bucket}/${cleanPath}"`);
    }

    // Convert Web ReadableStream to Node.js Readable stream
    const nodeStream = Readable.fromWeb(res.body as any);
    const contentLength = res.headers.get('content-length')
      ? Number(res.headers.get('content-length'))
      : undefined;
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const eTag = res.headers.get('etag') || undefined;

    return {
      stream: nodeStream,
      contentLength,
      contentType,
      eTag,
    };
  }

  public async deleteObject(bucket: StorageBucket, objectPath: string): Promise<boolean> {
    const cleanPath = objectPath.replace(/^\/+/, '');
    const basename = cleanPath.split('/').pop() || cleanPath;

    // Reject deletion of protected production assets
    if (PROTECTED_STORAGE_OBJECTS.has(basename)) {
      console.warn(`[Storage Safety] Refusing to delete protected production asset "${basename}".`);
      return false;
    }

    const endpoint = `${this.supabaseUrl}/storage/v1/object/${bucket}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: this.getAuthHeaders('application/json'),
      body: JSON.stringify({ prefixes: [cleanPath] }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Storage Error] Failed to delete "${bucket}/${cleanPath}": HTTP ${res.status} - ${errText}`);
      return false;
    }

    const deletedItems = (await res.json().catch(() => [])) as Array<{ name: string }>;
    if (!Array.isArray(deletedItems) || deletedItems.length === 0) {
      console.warn(`[Storage Safety] Object "${cleanPath}" was not found or not deleted in bucket "${bucket}".`);
      return false;
    }

    return true;
  }

  public async listObjects(bucket: StorageBucket, prefix = ''): Promise<ObjectMetadata[]> {
    const cleanPrefix = prefix.replace(/^\/+/, '');
    const allObjects: ObjectMetadata[] = [];
    const PAGE_LIMIT = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const endpoint = `${this.supabaseUrl}/storage/v1/object/list/${bucket}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders('application/json'),
        body: JSON.stringify({
          prefix: cleanPrefix,
          limit: PAGE_LIMIT,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[Storage Error] Failed to list bucket "${bucket}" at offset ${offset}: HTTP ${res.status} - ${errText}`);
      }

      const items = (await res.json()) as any[];
      if (!Array.isArray(items) || items.length === 0) {
        break;
      }

      for (const i of items) {
        allObjects.push({
          name: i.name,
          id: i.id,
          size: Number(i.metadata?.size) || 0,
          contentType: i.metadata?.mimetype,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
          eTag: i.metadata?.eTag,
        });
      }

      if (items.length < PAGE_LIMIT) {
        hasMore = false;
      } else {
        offset += items.length;
      }
    }

    return allObjects;
  }
}
