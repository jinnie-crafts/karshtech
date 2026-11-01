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
  original_filename?: string;
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

export interface StorageInfo {
  provider: string;
  dataDir?: string;
  dbFile?: string;
  backupsDir?: string;
  isPersistent?: boolean;
  gamesCount: number;
  releasesCount: number;
  productsCount: number;
  usersCount: number;
}
