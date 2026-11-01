import type {
  GameRecord,
  ReleaseRecord,
  ProductRecord,
  UserRecord,
  StudioSettings,
  StorageInfo,
  MediaAssetRecord,
} from './types.js';

export interface IDatabaseProvider {
  /**
   * Lifecycle and identification
   */
  init(): Promise<void>;
  close(): Promise<void>;
  getProviderName(): string;
  getStorageInfo(): Promise<StorageInfo>;

  /**
   * Games Operations
   */
  getGames(): Promise<GameRecord[]>;
  getGameById(id: string): Promise<GameRecord | undefined>;
  getGameBySlug(slug: string): Promise<GameRecord | undefined>;
  createGame(game: Omit<GameRecord, 'id' | 'created_at' | 'updated_at'>): Promise<GameRecord>;
  updateGame(id: string, updates: Partial<Omit<GameRecord, 'id' | 'created_at'>>): Promise<GameRecord | null>;
  deleteGame(id: string): Promise<boolean>;

  /**
   * Releases Operations
   */
  getReleases(): Promise<ReleaseRecord[]>;
  getReleasesByGameId(gameId: string): Promise<ReleaseRecord[]>;
  getLatestReleaseByGameId(gameId: string, onlyPublished?: boolean): Promise<ReleaseRecord | undefined>;
  getReleaseById(id: string): Promise<ReleaseRecord | undefined>;
  createRelease(release: Omit<ReleaseRecord, 'id' | 'download_count' | 'created_at'>): Promise<ReleaseRecord>;
  updateRelease(id: string, updates: Partial<Omit<ReleaseRecord, 'id' | 'created_at'>>): Promise<ReleaseRecord | null>;
  deleteRelease(id: string): Promise<boolean>;
  incrementDownload(id: string): Promise<number>;

  /**
   * Products Operations
   */
  getProducts(includeDrafts?: boolean): Promise<ProductRecord[]>;
  getProductById(id: string): Promise<ProductRecord | undefined>;
  getProductBySlug(slug: string, includeDrafts?: boolean): Promise<ProductRecord | undefined>;
  createProduct(product: Omit<ProductRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ProductRecord>;
  updateProduct(id: string, updates: Partial<Omit<ProductRecord, 'id' | 'created_at'>>): Promise<ProductRecord | null>;
  deleteProduct(id: string): Promise<boolean>;

  /**
   * Users Operations
   */
  getUsers(): Promise<UserRecord[]>;
  getUserByUsername(username: string): Promise<UserRecord | undefined>;
  getUserById(id: string): Promise<UserRecord | undefined>;
  createUser(user: Omit<UserRecord, 'id' | 'created_at'>): Promise<UserRecord>;
  updateUserPassword(id: string, newHash: string): Promise<boolean>;
  updateUserUsername(id: string, newUsername: string): Promise<boolean>;

  /**
   * Studio Settings Operations
   */
  getSettings(): Promise<StudioSettings>;
  updateSettings(settings: Partial<StudioSettings>): Promise<StudioSettings>;

  /**
   * Media Assets Operations (Phase 4.5)
   */
  getMediaAssets(bucket?: string): Promise<MediaAssetRecord[]>;
  getMediaAssetById(id: string): Promise<MediaAssetRecord | null>;
  getMediaAssetByPath(bucket: string, objectPath: string): Promise<MediaAssetRecord | null>;
  createMediaAsset(asset: Omit<MediaAssetRecord, 'created_at' | 'updated_at'>): Promise<MediaAssetRecord>;
  updateMediaAsset(id: string, updates: Partial<Omit<MediaAssetRecord, 'id' | 'created_at'>>): Promise<MediaAssetRecord | null>;
  deleteMediaAsset(id: string): Promise<boolean>;
}
