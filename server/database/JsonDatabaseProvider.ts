import fs from 'fs';
import path from 'path';
import type { IDatabaseProvider } from './IDatabaseProvider.js';
import type {
  GameRecord,
  ReleaseRecord,
  ProductRecord,
  UserRecord,
  StudioSettings,
  DatabaseSchema,
  StorageInfo,
  MediaAssetRecord,
} from './types.js';
import {
  DATA_DIR,
  DB_FILE,
  BACKUPS_DIR,
  IMAGES_DIR,
  APKS_DIR,
  IS_PERSISTENT_STORAGE,
  ensureStorageDirectories,
} from '../paths.js';

export class JsonDatabaseProvider implements IDatabaseProvider {
  private data: DatabaseSchema;
  private lastBackupTime = 0;
  private initialized = false;
  private dbPath: string;
  private dataDir: string;
  private backupsDir: string;

  constructor(customDbPath?: string, customBackupsDir?: string) {
    this.dbPath = customDbPath || DB_FILE;
    this.dataDir = path.dirname(this.dbPath);
    this.backupsDir = customBackupsDir || BACKUPS_DIR;
    ensureStorageDirectories();
    this.data = this.load();
  }

  public async init(): Promise<void> {
    if (!this.initialized) {
      this.ensureDirectory(this.dataDir);
      this.ensureDirectory(this.backupsDir);
      this.data = this.load();
      this.initialized = true;
      console.log(`[DB-JSON] JSON Database Provider initialized. Persistent: ${IS_PERSISTENT_STORAGE}. Path: ${this.dbPath}`);
    }
  }

  public async close(): Promise<void> {
    // Flush any pending save
    this.save();
    console.log('[DB-JSON] JSON Database Provider closed.');
  }

  public getProviderName(): string {
    return 'json';
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public createBackup(tag = 'auto'): string | null {
    try {
      this.ensureDirectory(this.backupsDir);
      if (!fs.existsSync(this.dbPath)) return null;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupsDir, `db_backup_${timestamp}_${tag}.json`);
      fs.copyFileSync(this.dbPath, backupPath);
      this.lastBackupTime = Date.now();
      this.pruneOldBackups();
      return backupPath;
    } catch (err) {
      console.warn('[DB-JSON] Warning creating database backup:', err);
      return null;
    }
  }

  private pruneOldBackups(maxBackups = 20): void {
    try {
      if (!fs.existsSync(this.backupsDir)) return;
      const files = fs
        .readdirSync(this.backupsDir)
        .filter((f) => f.startsWith('db_backup_') && f.endsWith('.json'))
        .map((f) => ({
          name: f,
          fullPath: path.join(this.backupsDir, f),
          time: fs.statSync(path.join(this.backupsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > maxBackups) {
        const toDelete = files.slice(maxBackups);
        for (const file of toDelete) {
          try {
            fs.unlinkSync(file.fullPath);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[DB-JSON] Warning pruning old backups:', err);
    }
  }

  private tryRecoverFromBackup(): DatabaseSchema | null {
    try {
      if (!fs.existsSync(this.backupsDir)) return null;
      const backupFiles = fs
        .readdirSync(this.backupsDir)
        .filter((f) => f.startsWith('db_backup_') && f.endsWith('.json'))
        .map((f) => ({
          path: path.join(this.backupsDir, f),
          time: fs.statSync(path.join(this.backupsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      for (const b of backupFiles) {
        try {
          const raw = fs.readFileSync(b.path, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.games) && Array.isArray(parsed.users)) {
            console.log(`[DB-JSON RECOVERY] Restoring valid state from backup: ${b.path}`);
            return parsed;
          }
        } catch {}
      }
    } catch {}
    return null;
  }

  private load(): DatabaseSchema {
    this.ensureDirectory(this.dataDir);
    this.ensureDirectory(this.backupsDir);

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        if (!raw.trim()) {
          throw new Error('db.json is zero bytes or empty whitespace');
        }
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('db.json root is not an object');
        }
        if (!Array.isArray(parsed.games)) parsed.games = [];
        if (!Array.isArray(parsed.releases)) parsed.releases = [];
        if (!Array.isArray(parsed.users)) parsed.users = [];
        if (!Array.isArray(parsed.products)) parsed.products = [];
        if (!parsed.settings || typeof parsed.settings !== 'object') {
          parsed.settings = {
            studio_name: 'Karsh Tech',
            tagline: 'Turning Ideas into Digital Reality',
            contact_email: 'karshhtech@gmail.com',
            updated_at: new Date().toISOString(),
          };
        }
        return parsed;
      } catch (err: any) {
        console.error(`[DB-JSON CRITICAL] Failed to parse db.json at ${this.dbPath}:`, err.message);

        // Preserve corrupt file for analysis
        const corruptPath = `${this.dbPath}.corrupt.${Date.now()}`;
        try {
          fs.copyFileSync(this.dbPath, corruptPath);
          console.error(`[DB-JSON CRITICAL] Corrupt file preserved safely at: ${corruptPath}`);
        } catch {}

        // Attempt recovery from backup
        const recovered = this.tryRecoverFromBackup();
        if (recovered) {
          return recovered;
        }

        // Refuse to silently overwrite database with empty data
        throw new Error(
          `CRITICAL: Database at ${this.dbPath} is corrupted and no valid backup was found. Refusing to overwrite production data with an empty database. Corrupt file preserved at ${corruptPath}.`
        );
      }
    }

    const initialData: DatabaseSchema = {
      games: [],
      releases: [],
      users: [],
      products: [],
      settings: {
        studio_name: 'Karsh Tech',
        tagline: 'Turning Ideas into Digital Reality',
        contact_email: 'karshhtech@gmail.com',
        updated_at: new Date().toISOString(),
      },
    };
    return initialData;
  }

  public save(): void {
    try {
      this.ensureDirectory(this.dataDir);

      // Create a backup if more than 10 minutes have elapsed since last backup or if file exists
      if (fs.existsSync(this.dbPath) && Date.now() - this.lastBackupTime > 10 * 60 * 1000) {
        this.createBackup('auto');
      }

      const tmpFile = path.join(
        this.dataDir,
        `db.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      );
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, this.dbPath);
    } catch (err) {
      console.error('[DB-JSON] Failed to atomically persist db.json:', err);
      throw err;
    }
  }

  public reload(): void {
    this.data = this.load();
  }

  public async getStorageInfo(): Promise<StorageInfo> {
    return {
      provider: 'json',
      dataDir: this.dataDir,
      dbFile: this.dbPath,
      backupsDir: this.backupsDir,
      isPersistent: IS_PERSISTENT_STORAGE,
      gamesCount: this.data.games.length,
      releasesCount: this.data.releases.length,
      productsCount: (this.data.products || []).length,
      usersCount: this.data.users.length,
    };
  }

  // Games Operations
  public async getGames(): Promise<GameRecord[]> {
    return [...this.data.games];
  }

  public async getGameById(id: string): Promise<GameRecord | undefined> {
    return this.data.games.find((g) => g.id === id);
  }

  public async getGameBySlug(slug: string): Promise<GameRecord | undefined> {
    return this.data.games.find((g) => g.slug.toLowerCase() === slug.toLowerCase());
  }

  public async createGame(game: Omit<GameRecord, 'id' | 'created_at' | 'updated_at'>): Promise<GameRecord> {
    const id = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newGame: GameRecord = {
      ...game,
      id,
      created_at: now,
      updated_at: now,
    };
    this.data.games.push(newGame);
    this.save();
    return newGame;
  }

  public async updateGame(id: string, updates: Partial<Omit<GameRecord, 'id' | 'created_at'>>): Promise<GameRecord | null> {
    const idx = this.data.games.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    this.data.games[idx] = {
      ...this.data.games[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.data.games[idx];
  }

  public async deleteGame(id: string): Promise<boolean> {
    const game = this.data.games.find((g) => g.id === id);
    if (!game) return false;

    this.data.games = this.data.games.filter((g) => g.id !== id);

    // Associated releases to remove
    const gameReleases = this.data.releases.filter((r) => r.game_id === id);
    this.data.releases = this.data.releases.filter((r) => r.game_id !== id);

    // Clean up unreferenced APK files from disk safely
    for (const rel of gameReleases) {
      if (rel.apk_filename) {
        const isStillUsed = this.data.releases.some((r) => r.apk_filename === rel.apk_filename);
        if (!isStillUsed) {
          const apkPath = path.join(APKS_DIR, rel.apk_filename);
          if (fs.existsSync(apkPath)) {
            try {
              fs.unlinkSync(apkPath);
            } catch (err) {
              console.warn('[DB-JSON] Warning removing APK file during game deletion:', err);
            }
          }
        }
      }
    }

    // Clean up uploaded images if not referenced anywhere else and not protected
    const imagesToCheck = [game.cover_image, game.banner_image, ...(game.screenshots || [])].filter(Boolean) as string[];
    const protectedImages = new Set([
      'default_cover.jpg',
      'avatar_harsh.png',
      'avatar_aditya.png',
      'avatar_komal.png',
    ]);

    for (const imgUrl of imagesToCheck) {
      if (typeof imgUrl === 'string' && imgUrl.startsWith('/uploads/images/')) {
        const filename = path.basename(imgUrl);
        if (!protectedImages.has(filename) && !filename.startsWith('avatar_')) {
          const isReferencedByOtherGame = this.data.games.some((g) =>
            g.cover_image === imgUrl ||
            g.banner_image === imgUrl ||
            g.screenshots.includes(imgUrl)
          );
          if (!isReferencedByOtherGame) {
            const imgPath = path.join(IMAGES_DIR, filename);
            if (fs.existsSync(imgPath)) {
              try {
                fs.unlinkSync(imgPath);
              } catch (err) {
                console.warn('[DB-JSON] Warning removing image file during game deletion:', err);
              }
            }
          }
        }
      }
    }

    this.save();
    return true;
  }

  // Releases Operations
  public async getReleases(): Promise<ReleaseRecord[]> {
    return this.data.releases.map((r) => ({
      ...r,
      original_filename: r.original_filename || r.apk_filename,
    }));
  }

  public async getReleasesByGameId(gameId: string): Promise<ReleaseRecord[]> {
    const game = await this.getGameById(gameId) || await this.getGameBySlug(gameId);
    const targetId = game?.id || gameId;
    const targetSlug = game?.slug;
    return this.data.releases
      .filter((r) => r.game_id === targetId || (targetSlug && r.game_id === targetSlug))
      .map((r) => ({
        ...r,
        original_filename: r.original_filename || r.apk_filename,
      }));
  }

  public async getLatestReleaseByGameId(gameId: string, onlyPublished = true): Promise<ReleaseRecord | undefined> {
    const game = await this.getGameById(gameId) || await this.getGameBySlug(gameId);
    const targetId = game?.id || gameId;
    const targetSlug = game?.slug;
    const releases = this.data.releases.filter(
      (r) =>
        (r.game_id === targetId || (targetSlug && r.game_id === targetSlug)) &&
        (!onlyPublished || r.is_published)
    );
    const latest = releases.sort((a, b) => b.version_code - a.version_code)[0];
    if (!latest) return undefined;
    return {
      ...latest,
      original_filename: latest.original_filename || latest.apk_filename,
    };
  }

  public async getReleaseById(id: string): Promise<ReleaseRecord | undefined> {
    const rel = this.data.releases.find((r) => r.id === id);
    if (!rel) return undefined;
    return {
      ...rel,
      original_filename: rel.original_filename || rel.apk_filename,
    };
  }

  public async createRelease(release: Omit<ReleaseRecord, 'id' | 'download_count' | 'created_at'>): Promise<ReleaseRecord> {
    const id = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRelease: ReleaseRecord = {
      ...release,
      original_filename: release.original_filename || release.apk_filename,
      id,
      download_count: 0,
      created_at: new Date().toISOString(),
    };
    this.data.releases.push(newRelease);
    this.save();
    return newRelease;
  }

  public async updateRelease(id: string, updates: Partial<Omit<ReleaseRecord, 'id' | 'created_at'>>): Promise<ReleaseRecord | null> {
    const idx = this.data.releases.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.releases[idx] = {
      ...this.data.releases[idx],
      ...updates,
    };
    this.save();
    return this.data.releases[idx];
  }

  public async deleteRelease(id: string): Promise<boolean> {
    const initialLen = this.data.releases.length;
    this.data.releases = this.data.releases.filter((r) => r.id !== id);
    if (this.data.releases.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public async incrementDownload(id: string): Promise<number> {
    const release = this.data.releases.find((r) => r.id === id);
    if (release) {
      release.download_count = (release.download_count || 0) + 1;
      this.save();
      return release.download_count;
    }
    return 0;
  }

  // Users Operations
  public async getUsers(): Promise<UserRecord[]> {
    return [...this.data.users];
  }

  public async getUserByUsername(username: string): Promise<UserRecord | undefined> {
    return this.data.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  public async getUserById(id: string): Promise<UserRecord | undefined> {
    return this.data.users.find((u) => u.id === id);
  }

  public async createUser(user: Omit<UserRecord, 'id' | 'created_at'>): Promise<UserRecord> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser: UserRecord = {
      ...user,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  public async updateUserPassword(id: string, newHash: string): Promise<boolean> {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return false;
    user.password_hash = newHash;
    this.save();
    return true;
  }

  public async updateUserUsername(id: string, newUsername: string): Promise<boolean> {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return false;
    user.username = newUsername;
    this.save();
    return true;
  }

  // Products Operations
  public async getProducts(includeDrafts: boolean = false): Promise<ProductRecord[]> {
    const list = Array.isArray(this.data.products) ? [...this.data.products] : [];
    const sorted = list.sort((a, b) => {
      const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.id || '').localeCompare(a.id || '');
    });
    if (includeDrafts) {
      return sorted;
    }
    return sorted.filter((p) => p.status === 'Published');
  }

  public async getProductById(id: string): Promise<ProductRecord | undefined> {
    if (!Array.isArray(this.data.products)) return undefined;
    return this.data.products.find((p) => p.id === id);
  }

  public async getProductBySlug(slug: string, includeDrafts: boolean = false): Promise<ProductRecord | undefined> {
    if (!Array.isArray(this.data.products)) return undefined;
    const lower = slug.toLowerCase();
    const product = this.data.products.find((p) => p.slug.toLowerCase() === lower);
    if (!product) return undefined;
    if (!includeDrafts && product.status !== 'Published') return undefined;
    return product;
  }

  public async createProduct(product: Omit<ProductRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ProductRecord> {
    if (!Array.isArray(this.data.products)) {
      this.data.products = [];
    }
    const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newProduct: ProductRecord = {
      ...product,
      id,
      gallery: Array.isArray(product.gallery) ? product.gallery : [],
      technologies: Array.isArray(product.technologies) ? product.technologies : [],
      display_order: typeof product.display_order === 'number' ? product.display_order : 0,
      featured: Boolean(product.featured),
      created_at: now,
      updated_at: now,
      published_at: product.status === 'Published' ? now : undefined,
    };
    this.data.products.push(newProduct);
    this.save();
    return newProduct;
  }

  public async updateProduct(id: string, updates: Partial<Omit<ProductRecord, 'id' | 'created_at'>>): Promise<ProductRecord | null> {
    if (!Array.isArray(this.data.products)) return null;
    const idx = this.data.products.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const existing = this.data.products[idx];
    const now = new Date().toISOString();
    let published_at = existing.published_at;

    if (updates.status === 'Published' && existing.status !== 'Published') {
      published_at = now;
    } else if (updates.status === 'Draft') {
      published_at = undefined;
    }

    // Explicitly protect id and created_at from mutation on update
    const { id: _ignoreId, created_at: _ignoreCreatedAt, ...safeUpdates } = updates as any;

    this.data.products[idx] = {
      ...existing,
      ...safeUpdates,
      id: existing.id,
      created_at: existing.created_at,
      published_at,
      updated_at: now,
    };
    this.save();
    return this.data.products[idx];
  }

  public async deleteProduct(id: string): Promise<boolean> {
    if (!Array.isArray(this.data.products)) return false;
    const product = this.data.products.find((p) => p.id === id);
    if (!product) return false;

    this.data.products = this.data.products.filter((p) => p.id !== id);
    this.save();
    return true;
  }

  // Settings Operations
  public async getSettings(): Promise<StudioSettings> {
    return { ...this.data.settings };
  }

  public async updateSettings(settings: Partial<StudioSettings>): Promise<StudioSettings> {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.data.settings;
  }

  // ==========================================
  // Media Assets Operations (Phase 4.5)
  // ==========================================

  public async getMediaAssets(bucket?: string): Promise<MediaAssetRecord[]> {
    const list = Array.isArray(this.data.media_assets) ? [...this.data.media_assets] : [];
    const sorted = list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (bucket && bucket !== 'all') {
      return sorted.filter((m) => m.bucket === bucket);
    }
    return sorted;
  }

  public async getMediaAssetById(id: string): Promise<MediaAssetRecord | null> {
    if (!Array.isArray(this.data.media_assets)) return null;
    return this.data.media_assets.find((m) => m.id === id) || null;
  }

  public async getMediaAssetByPath(bucket: string, objectPath: string): Promise<MediaAssetRecord | null> {
    if (!Array.isArray(this.data.media_assets)) return null;
    const cleanPath = objectPath.replace(/^\/+/, '');
    return (
      this.data.media_assets.find((m) => m.bucket === bucket && m.object_path.replace(/^\/+/, '') === cleanPath) ||
      null
    );
  }

  public async createMediaAsset(asset: Omit<MediaAssetRecord, 'created_at' | 'updated_at'>): Promise<MediaAssetRecord> {
    if (!Array.isArray(this.data.media_assets)) {
      this.data.media_assets = [];
    }
    const cleanPath = asset.object_path.replace(/^\/+/, '');
    const now = new Date().toISOString();
    const existingIdx = this.data.media_assets.findIndex(
      (m) => m.bucket === asset.bucket && m.object_path.replace(/^\/+/, '') === cleanPath
    );

    const record: MediaAssetRecord = {
      ...asset,
      object_path: cleanPath,
      created_at: existingIdx >= 0 ? this.data.media_assets[existingIdx].created_at : now,
      updated_at: now,
    };

    if (existingIdx >= 0) {
      this.data.media_assets[existingIdx] = record;
    } else {
      this.data.media_assets.push(record);
    }
    this.save();
    return record;
  }

  public async updateMediaAsset(
    id: string,
    updates: Partial<Omit<MediaAssetRecord, 'id' | 'created_at'>>
  ): Promise<MediaAssetRecord | null> {
    if (!Array.isArray(this.data.media_assets)) return null;
    const idx = this.data.media_assets.findIndex((m) => m.id === id);
    if (idx === -1) return null;

    const existing = this.data.media_assets[idx];
    const updated: MediaAssetRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    };
    this.data.media_assets[idx] = updated;
    this.save();
    return updated;
  }

  public async deleteMediaAsset(id: string): Promise<boolean> {
    if (!Array.isArray(this.data.media_assets)) return false;
    const initialLen = this.data.media_assets.length;
    this.data.media_assets = this.data.media_assets.filter((m) => m.id !== id);
    if (this.data.media_assets.length < initialLen) {
      this.save();
      return true;
    }
    return false;
  }
}
