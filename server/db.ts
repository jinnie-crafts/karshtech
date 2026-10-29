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
}

export interface DatabaseSchema {
  games: GameRecord[];
  releases: ReleaseRecord[];
  users: UserRecord[];
  settings: StudioSettings;
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
        return JSON.parse(raw);
      } catch (err) {
        console.error('Error reading db.json, falling back to default schema', err);
      }
    }
    return {
      games: [],
      releases: [],
      users: [],
      settings: {
        studio_name: 'Karsh Tech',
        tagline: 'Crafting Next-Gen Gaming Experiences',
        contact_email: 'contact@karshtech.com',
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
    const initialLen = this.data.games.length;
    this.data.games = this.data.games.filter((g) => g.id !== id);
    // Also remove associated releases
    this.data.releases = this.data.releases.filter((r) => r.game_id !== id);
    if (this.data.games.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // Releases CRUD
  public getReleases(): ReleaseRecord[] {
    return [...this.data.releases];
  }

  public getReleasesByGameId(gameId: string): ReleaseRecord[] {
    return this.data.releases.filter((r) => r.game_id === gameId);
  }

  public getLatestReleaseByGameId(gameId: string, onlyPublished = true): ReleaseRecord | undefined {
    const releases = this.data.releases.filter(
      (r) => r.game_id === gameId && (!onlyPublished || r.is_published)
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
