import { Readable } from 'stream';
import crypto from 'crypto';
import type {
  IStorageService,
  StorageBucket,
  UploadOptions,
  UploadResult,
  ObjectMetadata,
  DownloadStreamResult,
} from '../storage/storageTypes.js';
import { PROTECTED_STORAGE_OBJECTS } from '../storage/storageConfig.js';

interface StoredMockObject {
  name: string;
  id: string;
  bucket: StorageBucket;
  path: string;
  buffer: Buffer;
  size: number;
  contentType: string;
  eTag: string;
  createdAt: string;
  updatedAt: string;
}

export class MockStorageService implements IStorageService {
  private objects = new Map<string, StoredMockObject>();
  private simulatedFailures = new Map<string, Error>();
  private simulatedPageSize: number | null = null;
  private paginationFailures = new Set<number>();
  private initialized = false;

  private makeKey(bucket: StorageBucket, objectPath: string): string {
    const cleanPath = objectPath.replace(/^\/+/, '');
    return `${bucket}::${cleanPath}`;
  }

  public async init(): Promise<void> {
    if (this.simulatedFailures.has('init')) {
      throw this.simulatedFailures.get('init')!;
    }
    this.initialized = true;
  }

  public getBucketVisibility(bucket: StorageBucket): 'public' | 'private' {
    return bucket === 'release-apks' ? 'private' : 'public';
  }

  public getPublicUrl(bucket: StorageBucket, objectPath: string): string {
    if (bucket === 'release-apks') {
      throw new Error('[Security Violation] Cannot generate public URL for private bucket "release-apks"');
    }
    const cleanPath = objectPath.replace(/^\/+/, '');
    return `https://mock-storage.local/${bucket}/${cleanPath}`;
  }

  public async upload(options: UploadOptions): Promise<UploadResult> {
    if (this.simulatedFailures.has('upload')) {
      throw this.simulatedFailures.get('upload')!;
    }

    const { bucket, path: rawPath, buffer, contentType, preventOverwrite = true } = options;
    const cleanPath = rawPath.replace(/^\/+/, '');
    const key = this.makeKey(bucket, cleanPath);

    if (preventOverwrite && this.objects.has(key)) {
      const existing = this.objects.get(key)!;
      if (existing.size !== buffer.length) {
        throw new Error(
          `[Storage Conflict] Object "${cleanPath}" already exists in bucket "${bucket}" with different size (HTTP 409). Overwriting is disabled.`
        );
      }
      if (!existing.buffer.equals(buffer)) {
        throw new Error(
          `[Storage Conflict] Object "${cleanPath}" already exists in bucket "${bucket}" with different content (HTTP 409). Overwriting is disabled.`
        );
      }
      return {
        success: true,
        bucket,
        path: cleanPath,
        url: bucket === 'release-apks' ? '/api/releases/download' : this.getPublicUrl(bucket, cleanPath),
        size: existing.size,
        contentType: existing.contentType,
        eTag: existing.eTag,
      };
    }

    const eTag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
    const now = new Date().toISOString();
    const stored: StoredMockObject = {
      name: cleanPath.split('/').pop() || cleanPath,
      id: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bucket,
      path: cleanPath,
      buffer,
      size: buffer.length,
      contentType,
      eTag,
      createdAt: now,
      updatedAt: now,
    };

    this.objects.set(key, stored);

    return {
      success: true,
      bucket,
      path: cleanPath,
      url: bucket === 'release-apks' ? '/api/releases/download' : this.getPublicUrl(bucket, cleanPath),
      size: buffer.length,
      contentType,
      eTag,
    };
  }

  public async getObjectMetadata(bucket: StorageBucket, objectPath: string): Promise<ObjectMetadata | null> {
    if (this.simulatedFailures.has('getObjectMetadata')) {
      throw this.simulatedFailures.get('getObjectMetadata')!;
    }

    const cleanPath = objectPath.replace(/^\/+/, '');
    const key = this.makeKey(bucket, cleanPath);
    const obj = this.objects.get(key);
    if (!obj) return null;

    return {
      name: obj.name,
      id: obj.id,
      size: obj.size,
      contentType: obj.contentType,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
      eTag: obj.eTag,
    };
  }

  public async downloadPrivate(bucket: StorageBucket, objectPath: string): Promise<DownloadStreamResult> {
    if (this.simulatedFailures.has('downloadPrivate')) {
      throw this.simulatedFailures.get('downloadPrivate')!;
    }

    const cleanPath = objectPath.replace(/^\/+/, '');
    const key = this.makeKey(bucket, cleanPath);
    const obj = this.objects.get(key);

    if (!obj) {
      throw new Error(`[Storage 404] Object "${cleanPath}" was not found in bucket "${bucket}"`);
    }

    return {
      stream: Readable.from(obj.buffer),
      contentLength: obj.size,
      contentType: obj.contentType,
      eTag: obj.eTag,
    };
  }

  public async deleteObject(bucket: StorageBucket, objectPath: string): Promise<boolean> {
    if (this.simulatedFailures.has('deleteObject')) {
      throw this.simulatedFailures.get('deleteObject')!;
    }

    const cleanPath = objectPath.replace(/^\/+/, '');
    const basename = cleanPath.split('/').pop() || cleanPath;

    if (PROTECTED_STORAGE_OBJECTS.has(basename)) {
      console.warn(`[MockStorage Safety] Refusing to delete protected production asset "${basename}".`);
      return false;
    }

    const key = this.makeKey(bucket, cleanPath);
    return this.objects.delete(key);
  }

  public async listObjects(bucket: StorageBucket, prefix = ''): Promise<ObjectMetadata[]> {
    if (this.simulatedFailures.has('listObjects')) {
      throw this.simulatedFailures.get('listObjects')!;
    }

    const cleanPrefix = prefix.replace(/^\/+/, '');
    const matched: ObjectMetadata[] = [];

    for (const [key, obj] of this.objects.entries()) {
      if (obj.bucket === bucket) {
        if (!cleanPrefix || obj.path.startsWith(cleanPrefix)) {
          matched.push({
            name: obj.name,
            id: obj.id,
            size: obj.size,
            contentType: obj.contentType,
            createdAt: obj.createdAt,
            updatedAt: obj.updatedAt,
            eTag: obj.eTag,
          });
        }
      }
    }

    matched.sort((a, b) => a.name.localeCompare(b.name));

    if (this.simulatedPageSize !== null && this.simulatedPageSize > 0) {
      const pageSize = this.simulatedPageSize;
      const allPages: ObjectMetadata[] = [];
      let offset = 0;

      while (offset < matched.length || (matched.length === 0 && offset === 0)) {
        if (this.paginationFailures.has(offset)) {
          throw new Error(`[MockStorage Error] Simulated pagination failure at offset ${offset}`);
        }
        const pageSlice = matched.slice(offset, offset + pageSize);
        allPages.push(...pageSlice);
        if (pageSlice.length < pageSize) {
          break;
        }
        offset += pageSlice.length;
      }
      return allPages;
    }

    return matched;
  }

  // Test manipulation helpers
  public setSimulatedPageSize(size: number | null): void {
    this.simulatedPageSize = size;
  }

  public simulatePaginationFailureAtOffset(offset: number): void {
    this.paginationFailures.add(offset);
  }

  public clearPaginationSimulation(): void {
    this.simulatedPageSize = null;
    this.paginationFailures.clear();
  }

  public reset(): void {
    this.objects.clear();
    this.simulatedFailures.clear();
    this.simulatedPageSize = null;
    this.paginationFailures.clear();
  }

  public simulateFailure(methodName: string, error: Error): void {
    this.simulatedFailures.set(methodName, error);
  }

  public clearSimulatedFailure(methodName: string): void {
    this.simulatedFailures.delete(methodName);
  }

  public seedObject(bucket: StorageBucket, objectPath: string, buffer: Buffer, contentType: string): void {
    const cleanPath = objectPath.replace(/^\/+/, '');
    const key = this.makeKey(bucket, cleanPath);
    const now = new Date().toISOString();
    this.objects.set(key, {
      name: cleanPath.split('/').pop() || cleanPath,
      id: `seed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bucket,
      path: cleanPath,
      buffer,
      size: buffer.length,
      contentType,
      eTag: `"${crypto.createHash('md5').update(buffer).digest('hex')}"`,
      createdAt: now,
      updatedAt: now,
    });
  }
}
