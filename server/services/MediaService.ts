import path from 'path';
import crypto from 'crypto';
import type { IStorageService, StorageBucket, ObjectMetadata } from '../storage/storageTypes.js';
import type { IDatabaseProvider } from '../database/IDatabaseProvider.js';
import type { GameRecord, ProductRecord, MediaAssetRecord, MediaAssetCategory } from '../database/types.js';
import { PROTECTED_STORAGE_OBJECTS } from '../storage/storageConfig.js';

export class MediaService {
  private storage: IStorageService;
  private db: IDatabaseProvider;

  constructor(storage: IStorageService, db: IDatabaseProvider) {
    this.storage = storage;
    this.db = db;
  }

  /**
   * Resolves any media reference (legacy relative /uploads path, bare filename, or CDN URL)
   * into its authoritative, canonical Supabase Storage public CDN URL.
   * Static repository assets (/brand/...) and external URLs are preserved.
   */
  public resolveCanonicalUrl(urlOrPath: string | null | undefined, bucketHint: StorageBucket = 'game-assets'): string {
    if (!urlOrPath || typeof urlOrPath !== 'string') return '';
    const clean = urlOrPath.trim();
    if (!clean) return '';

    // 1. External or already-canonical Supabase CDN URLs
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }

    // 2. Static application brand assets bundled in public/
    if (clean.startsWith('/brand/') || clean.startsWith('brand/')) {
      return clean.startsWith('/') ? clean : `/${clean}`;
    }

    // 3. Strip query parameters (e.g. ?v=1.0.1) and hash fragments
    const stripped = clean.split('?')[0].split('#')[0].trim();

    // 4. Legacy /uploads/images/... or /uploads/... path
    if (stripped.startsWith('/uploads/images/') || stripped.startsWith('uploads/images/')) {
      const basename = path.basename(stripped);
      try {
        return this.storage.getPublicUrl('game-assets', basename);
      } catch {
        return clean;
      }
    }

    if (stripped.startsWith('/uploads/') || stripped.startsWith('uploads/')) {
      const basename = path.basename(stripped);
      try {
        return this.storage.getPublicUrl(bucketHint, basename);
      } catch {
        return clean;
      }
    }

    // 5. Bare filename or clean object path (e.g. arrow_puzzle_screenshot_1.jpg)
    const basename = path.basename(stripped);
    if (basename && !basename.includes('/')) {
      try {
        return this.storage.getPublicUrl(bucketHint, basename);
      } catch {
        return clean;
      }
    }

    return clean;
  }

  /**
   * Resolves all dynamic media fields on a game record into canonical CDN URLs.
   */
  public resolveGameMedia(game: GameRecord): GameRecord {
    return {
      ...game,
      cover_image: this.resolveCanonicalUrl(game.cover_image, 'game-assets'),
      banner_image: game.banner_image ? this.resolveCanonicalUrl(game.banner_image, 'game-assets') : undefined,
      screenshots: Array.isArray(game.screenshots)
        ? game.screenshots.map((s) => this.resolveCanonicalUrl(s, 'game-assets'))
        : [],
    };
  }

  /**
   * Resolves all dynamic media fields on a product record into canonical CDN URLs.
   */
  public resolveProductMedia(product: ProductRecord): ProductRecord {
    return {
      ...product,
      cover_image: this.resolveCanonicalUrl(product.cover_image, 'product-assets'),
      gallery: Array.isArray(product.gallery)
        ? product.gallery.map((g) => this.resolveCanonicalUrl(g, 'product-assets'))
        : [],
    };
  }

  /**
   * Infers asset category from filename, bucket, and mimetype
   */
  public inferCategory(filename: string, bucket: StorageBucket, mimetype?: string): MediaAssetCategory {
    const lower = filename.toLowerCase();
    if (bucket === 'release-apks' || lower.endsWith('.apk')) return 'apk';
    if (lower.startsWith('avatar_') || lower.includes('avatar')) return 'avatar';
    if (lower.includes('banner')) return 'banner';
    if (lower.includes('cover')) return 'cover';
    if (lower.includes('screenshot') || lower.includes('screen')) return 'screenshot';
    if (bucket === 'product-assets' || lower.includes('gallery')) return 'gallery';
    return 'other';
  }

  /**
   * Registers or updates metadata in the PostgreSQL media_assets table if available.
   */
  public async registerAssetMetadata(options: {
    bucket: StorageBucket;
    objectPath: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    sha256?: string;
    category?: MediaAssetCategory;
    isProtected?: boolean;
    metadata?: Record<string, any>;
  }): Promise<MediaAssetRecord | null> {
    try {
      const cleanPath = options.objectPath.replace(/^\/+/, '');
      const basename = path.basename(cleanPath);
      const category = options.category || this.inferCategory(cleanPath, options.bucket, options.mimeType);
      const isProtected = options.isProtected ?? PROTECTED_STORAGE_OBJECTS.has(basename);
      const sha256 = options.sha256 || '0000000000000000000000000000000000000000000000000000000000000000';
      const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      return await this.db.createMediaAsset({
        id,
        bucket: options.bucket,
        object_path: cleanPath,
        original_filename: options.originalFilename,
        mime_type: options.mimeType,
        size_bytes: options.sizeBytes,
        sha256,
        category,
        is_protected: isProtected,
        metadata: options.metadata || {},
      });
    } catch (err: any) {
      // Gracefully fall back if media_assets table is not yet migrated in this environment
      return null;
    }
  }

  /**
   * Synchronizes known storage objects into media_assets metadata table
   */
  public async syncStorageCatalog(): Promise<{ synced: number; errors: number }> {
    const buckets: StorageBucket[] = ['game-assets', 'product-assets', 'release-apks'];
    let synced = 0;
    let errors = 0;

    for (const bucket of buckets) {
      try {
        const objects = await this.storage.listObjects(bucket);
        for (const obj of objects) {
          try {
            const existing = await this.db.getMediaAssetByPath(bucket, obj.name);
            if (!existing) {
              await this.registerAssetMetadata({
                bucket,
                objectPath: obj.name,
                originalFilename: obj.name,
                mimeType: obj.contentType || (bucket === 'release-apks' ? 'application/vnd.android.package-archive' : 'image/jpeg'),
                sizeBytes: obj.size,
                category: this.inferCategory(obj.name, bucket, obj.contentType),
                isProtected: PROTECTED_STORAGE_OBJECTS.has(obj.name),
              });
              synced++;
            }
          } catch {
            errors++;
          }
        }
      } catch {
        errors++;
      }
    }

    return { synced, errors };
  }
}
