import type { Readable } from 'stream';

export type StorageBucket = 'game-assets' | 'product-assets' | 'release-apks';

export interface UploadOptions {
  bucket: StorageBucket;
  path: string;
  buffer: Buffer;
  contentType: string;
  preventOverwrite?: boolean;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  success: boolean;
  bucket: StorageBucket;
  path: string;
  url: string;
  size: number;
  contentType: string;
  eTag?: string;
}

export interface ObjectMetadata {
  name: string;
  id?: string;
  size: number;
  contentType?: string;
  createdAt?: string;
  updatedAt?: string;
  eTag?: string;
}

export interface DownloadStreamResult {
  stream: Readable;
  contentLength?: number;
  contentType: string;
  eTag?: string;
}

export interface IStorageService {
  init(): Promise<void>;
  upload(options: UploadOptions): Promise<UploadResult>;
  downloadPrivate(bucket: StorageBucket, path: string): Promise<DownloadStreamResult>;
  getObjectMetadata(bucket: StorageBucket, path: string): Promise<ObjectMetadata | null>;
  getPublicUrl(bucket: StorageBucket, path: string): string;
  deleteObject(bucket: StorageBucket, path: string): Promise<boolean>;
  listObjects(bucket: StorageBucket, prefix?: string): Promise<ObjectMetadata[]>;
  getBucketVisibility(bucket: StorageBucket): 'public' | 'private';
}
