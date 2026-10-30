import fs from 'fs';
import path from 'path';

export interface GameRequirements {
  min_android?: string;
  target_android?: string;
  storage?: string;
  ram?: string;
  internet?: string;
}

export interface ReleaseRecord {
  id: string;
  game_id: string;
  version_name: string;
  version_code: number;
  release_date: string;
  release_notes: string;
  apk_filename: string;
  apk_file_size: number;
  apk_download_url: string;
  min_sdk: number;
  target_sdk: number;
  is_published: boolean;
  download_count: number;
  created_at: string;
}

export interface GameRecord {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  genre: string[];
  platforms: string[];
  status: 'Available' | 'Coming Soon' | 'Updated' | 'In Beta';
  featured: boolean;
  cover_image: string;
  banner_image?: string;
  screenshots: string[];
  trailer_url?: string;
  features: string[];
  controls: string[];
  requirements: GameRequirements;
  developer: string;
  created_at: string;
  updated_at: string;
}

export type ProductCategory = 'Websites' | 'Web Applications' | 'Mobile Applications' | 'Games' | 'Custom Software';
export type ProductPlatform = 'Web' | 'Android' | 'iOS' | 'Desktop' | 'Cross-platform';
export type ProductStatus = 'Draft' | 'Published';

export interface ProductRecord {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  category: ProductCategory;
  cover_image: string;
  gallery: string[];
  technologies: string[];
  project_url?: string;
  github_url?: string;
  play_store_url?: string;
  apk_download_url?: string;
  platform: ProductPlatform;
  status: ProductStatus;
  featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  role: 'superadmin' | 'admin';
  created_at: string;
}

export interface StudioSettings {
  studio_name: string;
  tagline: string;
  contact_email: string;
  announcement?: string;
  updated_at: string;
  initial_seeded?: boolean;
}

export interface DatabaseSchema {
  games: GameRecord[];
  releases: ReleaseRecord[];
  users: UserRecord[];
  settings: StudioSettings;
  products?: ProductRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

class DatabaseEngine {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDirectory(DATA_DIR);
    this.data = this.load();
  }

  private ensureDirectory(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.products)) {
          parsed.products = [];
        }
        return parsed;
      } catch (err) {
        console.error('Error reading db.json, falling back to default schema', err);
      }
    }
    return {
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
  }

  public save(): void {
    try {
      this.ensureDirectory(DATA_DIR);
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to atomically persist db.json:', err);
    }
  }

  // Games CRUD
  public getGames(): GameRecord[] {
    return [...this.data.games];
  }

  public getGameById(id: string): GameRecord | undefined {
    return this.data.games.find((g) => g.id === id);
  }

  public getGameBySlug(slug: string): GameRecord | undefined {
    return this.data.games.find((g) => g.slug.toLowerCase() === slug.toLowerCase());
  }

  public createGame(game: Omit<GameRecord, 'id' | 'created_at' | 'updated_at'>): GameRecord {
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

  public updateGame(id: string, updates: Partial<Omit<GameRecord, 'id' | 'created_at'>>): GameRecord | null {
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

  public deleteGame(id: string): boolean {
    const game = this.data.games.find((g) => g.id === id);
    if (!game) return false;

    this.data.games = this.data.games.filter((g) => g.id !== id);

    // Associated releases to remove
    const gameReleases = this.data.releases.filter((r) => r.game_id === id);
    this.data.releases = this.data.releases.filter((r) => r.game_id !== id);

    // Clean up unreferenced APK files from disk safely
    const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads');
    const apksDir = path.join(uploadsDir, 'apks');
    const imagesDir = path.join(uploadsDir, 'images');

    for (const rel of gameReleases) {
      if (rel.apk_filename) {
        const isStillUsed = this.data.releases.some((r) => r.apk_filename === rel.apk_filename);
        if (!isStillUsed) {
          const apkPath = path.join(apksDir, rel.apk_filename);
          if (fs.existsSync(apkPath)) {
            try {
              fs.unlinkSync(apkPath);
            } catch (err) {
              console.warn('[DB] Warning removing APK file during game deletion:', err);
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
            const imgPath = path.join(imagesDir, filename);
            if (fs.existsSync(imgPath)) {
              try {
                fs.unlinkSync(imgPath);
              } catch (err) {
                console.warn('[DB] Warning removing image file during game deletion:', err);
              }
            }
          }
        }
      }
    }

    this.save();
    return true;
  }

  // Releases CRUD
  public getReleases(): ReleaseRecord[] {
    return [...this.data.releases];
  }

  public getReleasesByGameId(gameId: string): ReleaseRecord[] {
    const game = this.getGameById(gameId) || this.getGameBySlug(gameId);
    const targetId = game?.id || gameId;
    const targetSlug = game?.slug;
    return this.data.releases.filter(
      (r) => r.game_id === targetId || (targetSlug && r.game_id === targetSlug)
    );
  }

  public getLatestReleaseByGameId(gameId: string, onlyPublished = true): ReleaseRecord | undefined {
    const game = this.getGameById(gameId) || this.getGameBySlug(gameId);
    const targetId = game?.id || gameId;
    const targetSlug = game?.slug;
    const releases = this.data.releases.filter(
      (r) =>
        (r.game_id === targetId || (targetSlug && r.game_id === targetSlug)) &&
        (!onlyPublished || r.is_published)
    );
    return releases.sort((a, b) => b.version_code - a.version_code)[0];
  }

  public getReleaseById(id: string): ReleaseRecord | undefined {
    return this.data.releases.find((r) => r.id === id);
  }

  public createRelease(release: Omit<ReleaseRecord, 'id' | 'download_count' | 'created_at'>): ReleaseRecord {
    const id = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRelease: ReleaseRecord = {
      ...release,
      id,
      download_count: 0,
      created_at: new Date().toISOString(),
    };
    this.data.releases.push(newRelease);
    this.save();
    return newRelease;
  }

  public updateRelease(id: string, updates: Partial<Omit<ReleaseRecord, 'id' | 'created_at'>>): ReleaseRecord | null {
    const idx = this.data.releases.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.releases[idx] = {
      ...this.data.releases[idx],
      ...updates,
    };
    this.save();
    return this.data.releases[idx];
  }

  public deleteRelease(id: string): boolean {
    const initialLen = this.data.releases.length;
    this.data.releases = this.data.releases.filter((r) => r.id !== id);
    if (this.data.releases.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public incrementDownload(id: string): number {
    const release = this.data.releases.find((r) => r.id === id);
    if (release) {
      release.download_count = (release.download_count || 0) + 1;
      this.save();
      return release.download_count;
    }
    return 0;
  }

  // Users CRUD
  public getUsers(): UserRecord[] {
    return [...this.data.users];
  }

  public getUserByUsername(username: string): UserRecord | undefined {
    return this.data.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  public getUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public createUser(user: Omit<UserRecord, 'id' | 'created_at'>): UserRecord {
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

  public updateUserPassword(id: string, newHash: string): boolean {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return false;
    user.password_hash = newHash;
    this.save();
    return true;
  }

  public updateUserUsername(id: string, newUsername: string): boolean {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return false;
    user.username = newUsername;
    this.save();
    return true;
  }

  // Products CRUD
  public getProducts(includeDrafts: boolean = false): ProductRecord[] {
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

  public getProductById(id: string): ProductRecord | undefined {
    if (!Array.isArray(this.data.products)) return undefined;
    return this.data.products.find((p) => p.id === id);
  }

  public getProductBySlug(slug: string, includeDrafts: boolean = false): ProductRecord | undefined {
    if (!Array.isArray(this.data.products)) return undefined;
    const lower = slug.toLowerCase();
    const product = this.data.products.find((p) => p.slug.toLowerCase() === lower);
    if (!product) return undefined;
    if (!includeDrafts && product.status !== 'Published') return undefined;
    return product;
  }

  public createProduct(product: Omit<ProductRecord, 'id' | 'created_at' | 'updated_at'>): ProductRecord {
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

  public updateProduct(id: string, updates: Partial<Omit<ProductRecord, 'id' | 'created_at'>>): ProductRecord | null {
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

  public deleteProduct(id: string): boolean {
    if (!Array.isArray(this.data.products)) return false;
    const product = this.data.products.find((p) => p.id === id);
    if (!product) return false;

    this.data.products = this.data.products.filter((p) => p.id !== id);
    this.save();
    return true;
  }

  // Settings
  public getSettings(): StudioSettings {
    return { ...this.data.settings };
  }

  public updateSettings(settings: Partial<StudioSettings>): StudioSettings {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.data.settings;
  }
}

export const db = new DatabaseEngine();
